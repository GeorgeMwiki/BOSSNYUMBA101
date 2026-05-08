/**
 * Brain-kernel wiring — composes the central-intelligence `BrainKernel`
 * at the api-gateway composition root so consuming wirings (today: the
 * voice agent; later: every AI-native surface) can route turns through
 * the disciplined 13-step pipeline instead of bespoke per-surface LLM
 * calls.
 *
 * The kernel itself is provider- and storage-agnostic — `composeSovereign`
 * (from `@bossnyumba/central-intelligence/kernel/compose`) takes an
 * optional `AnthropicMessagesClient` plus a handful of optional ports
 * (cohort source, branding resolver, memory hierarchy, feedback,
 * agency, judge override) and stitches together:
 *
 *   - Anthropic sensors (Opus 4.7 / Sonnet 4.6 / Haiku 4.5) as the
 *     primary failover chain
 *   - Brain cache (in-memory; replace with Redis adapter when wired)
 *   - CoT reservoir + persona-drift sink + provenance sink
 *     (in-memory defaults; the Drizzle-backed substrate adapters land
 *     here once their service-registry slots stabilise)
 *   - Auto-Haiku judge for high-stakes turns when no override is given
 *
 * When no Anthropic client is available (no `ANTHROPIC_API_KEY` at boot)
 * `createBrainKernelWiring` returns `null` so the registry can fall
 * back to the polite degraded stub the voice agent already ships
 * (`VOICE_BRAIN_NOT_CONFIGURED`). This mirrors the same null-fallback
 * pattern used by `predictive-interventions-wiring` and
 * `market-surveillance-wiring`.
 *
 * Tenant isolation: kernel construction is per-deployment. Every
 * `kernel.think(req)` call carries the calling tenant on
 * `req.scope` (kind: 'tenant') so memory recall, cohort signals, and
 * provenance writes scope correctly. The kernel never fans tenant
 * data across the composition surface.
 *
 * Type-safety: `BrainKernel` is derived via `ReturnType<typeof
 * createBrainKernel>` to dodge the package-barrel namespace drift
 * (TS2709) the rest of this composition layer also works around — see
 * `voice-agent-wiring.ts` and `classroom-wiring.ts` for the same
 * pattern.
 */

import {
  composeSovereign,
  createBrainKernel,
} from '@bossnyumba/central-intelligence';

/**
 * Concrete `BrainKernel` shape derived from the factory. Keeping the
 * derivation local sidesteps the namespace-vs-type drift the rest of
 * the composition layer also routes around (TS2709).
 */
export type BrainKernel = ReturnType<typeof createBrainKernel>;

/**
 * Structural duck-shape of the Anthropic Messages client the kernel
 * sensors expect. Mirrors `AnthropicMessagesClient` in
 * `@bossnyumba/central-intelligence/kernel/sensors/anthropic-sensor`
 * but kept local so we can pass either an unguarded `AnthropicClient`'s
 * `.sdk` or a budget-guarded client's `.sdk` interchangeably.
 */
export interface KernelAnthropicSdkLike {
  readonly messages: {
    readonly create: (args: unknown) => Promise<unknown>;
  };
}

/**
 * Factory shape used at the composition root: the api-gateway constructs
 * a per-tenant `BudgetGuardedAnthropicClient` on demand. Voice-agent
 * turns currently do not flow through this guard at the kernel layer
 * (the kernel does not surface tenantId to its sensor calls); a follow-
 * up will lift tenant context into the sensor call args so the guard
 * can re-enter the loop. For now we accept the factory and pull a
 * single shared `.sdk` reference once at boot — usage is still tracked
 * by the voice-turns Drizzle adapter and the AI cost ledger sees the
 * downstream Anthropic SDK calls.
 */
export type BudgetGuardedAnthropicFactory = (
  tenantId: string,
  operation?: string,
) => { readonly sdk: KernelAnthropicSdkLike };

/**
 * Tenant id passed when we need to construct the budget-guarded client
 * once at boot to extract its `.sdk`. The actual per-tenant guarding
 * does not flow through the kernel's sensor calls today, so this id is
 * only used to satisfy the factory's `(tenantId, operation)` signature
 * and is never written to the cost ledger by the kernel itself.
 */
const KERNEL_BOOTSTRAP_TENANT_ID = '__kernel_bootstrap__';
const KERNEL_BOOTSTRAP_OPERATION = 'kernel.compose';

export interface BrainKernelWiringDeps {
  /**
   * Per-tenant Anthropic client factory built by the registry from
   * `ANTHROPIC_API_KEY`. When `null`, the wiring returns `null` so the
   * voice agent (and any future kernel consumer) drops to its degraded
   * fallback. The wiring deliberately does NOT throw here — the
   * gateway must boot end-to-end without external creds.
   */
  readonly buildBudgetGuardedAnthropicClient:
    | BudgetGuardedAnthropicFactory
    | null;
  /**
   * Optional structured logger. When provided, the wiring emits a
   * single info-level entry on successful kernel construction so
   * operators can confirm at boot that the central-intelligence brain
   * is online (vs. running with the degraded stub).
   */
  readonly logger?: {
    readonly info?: (meta: object, msg: string) => void;
    readonly warn?: (meta: object, msg: string) => void;
  };
}

export interface BrainKernelWiring {
  readonly kernel: BrainKernel;
  /** Bound `kernel.think` reference safe to pass to other wirings. */
  readonly think: BrainKernel['think'];
}

/**
 * Compose the central-intelligence `BrainKernel`. Returns `null` when
 * no LLM provider is wired so the registry can transparently fall back
 * to the voice agent's degraded stub (`VOICE_BRAIN_NOT_CONFIGURED`).
 *
 * The wiring is deliberately defensive:
 *   - if the factory call throws (network-init failure, malformed key),
 *     the wiring returns `null` after logging a warning rather than
 *     killing the gateway boot;
 *   - if `composeSovereign` itself throws (would happen only if no
 *     sensors were wired, which we guarantee by passing the Anthropic
 *     client), the wiring also returns `null` for the same reason.
 *
 * Side-effect-free for callers — every error is captured, never
 * propagated past the wiring boundary.
 */
export function createBrainKernelWiring(
  deps: BrainKernelWiringDeps,
): BrainKernelWiring | null {
  if (!deps.buildBudgetGuardedAnthropicClient) {
    return null;
  }

  let anthropicMessagesClient: KernelAnthropicSdkLike;
  try {
    const guarded = deps.buildBudgetGuardedAnthropicClient(
      KERNEL_BOOTSTRAP_TENANT_ID,
      KERNEL_BOOTSTRAP_OPERATION,
    );
    anthropicMessagesClient = guarded.sdk;
  } catch (err) {
    if (deps.logger?.warn) {
      deps.logger.warn(
        {
          wiring: 'brain-kernel',
          error: err instanceof Error ? err.message : String(err),
        },
        'brain-kernel: anthropic client construction failed; degrading',
      );
    }
    return null;
  }

  let kernel: BrainKernel;
  try {
    const sovereign = composeSovereign({
      anthropicClient: anthropicMessagesClient as Parameters<
        typeof composeSovereign
      >[0]['anthropicClient'],
    });
    kernel = sovereign.kernel;
  } catch (err) {
    if (deps.logger?.warn) {
      deps.logger.warn(
        {
          wiring: 'brain-kernel',
          error: err instanceof Error ? err.message : String(err),
        },
        'brain-kernel: composeSovereign failed; degrading',
      );
    }
    return null;
  }

  if (deps.logger?.info) {
    deps.logger.info(
      {
        wiring: 'brain-kernel',
        sensors: ['opus47', 'sonnet46', 'haiku45'],
        autoHaikuJudge: true,
      },
      'brain-kernel: composed (real-brain path active)',
    );
  }

  return {
    kernel,
    // Bind so callers can pass `wiring.think` as a free function value
    // without losing the `this` reference.
    think: kernel.think.bind(kernel),
  };
}
