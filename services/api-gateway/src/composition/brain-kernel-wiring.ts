/**
 * Brain-kernel wiring — composes the central-intelligence `BrainKernel`
 * at the api-gateway composition root so consuming wirings (today: the
 * voice agent; later: every AI-native surface) can route turns through
 * the disciplined 13-step pipeline instead of bespoke per-surface LLM
 * calls.
 *
 * Wave-K Tier-2 T1 wired the optional governance + cognition ports
 * onto the kernel:
 *
 *   - Env-driven killswitch (`createEnvKillswitchPort`) reads HALT /
 *     DEGRADED state from `KILLSWITCH_STATE` and per-tenant
 *     `KILLSWITCH_TENANT_<id>` env vars. The kernel runs a step 0
 *     short-circuit before any sensor work.
 *   - Always-on decision-trace recorder
 *     (`createDecisionTraceRecorder` over the in-memory store with a
 *     200-trace per-tenant cap) emits a per-thought breadcrumb of every
 *     step traversed. Exposed on the wiring slot so future admin routes
 *     can pull recent traces for an ops UI.
 *   - Uncertainty-policy gate, opt-in via the
 *     `BOSSNYUMBA_UNCERTAINTY_POLICY=on` env var. Default `'off'` to
 *     preserve baseline test contracts (the heuristic confidence
 *     scorer is permissive against synthetic short replies and would
 *     trip the caveat / escalate paths if turned on indiscriminately).
 *   - Brain-tool registry seeded with the 5 PM tools
 *     (`registerSeedBrainTools`). The default seed-deps surface a
 *     "not yet wired" error; concrete Drizzle adapters land in a
 *     follow-up via the `seedToolDeps` deps slot.
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
  createApprovalGate,
  createBrainKernel,
  createBrainToolRegistry,
  createDecisionTraceRecorder,
  createEnvKillswitchPort,
  createInMemoryApprovalStore,
  createInMemoryDecisionTraceStore,
  createNullEmbedder,
  createOpenAiEmbedder,
  registerSeedBrainTools,
  type ApprovalGate,
  type BrainToolRegistry,
  type BrainToolSpec,
  type DecisionTraceRecorder,
  type EmbedderPort,
  type KillswitchPort,
  type SeedBrainToolDeps,
} from '@bossnyumba/central-intelligence';
import {
  buildOrchestratorBindings,
  type OrchestratorBindings,
} from './orchestrator-bindings.js';

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
  /**
   * Optional environment source for the killswitch port and the
   * uncertainty-policy flag. Defaults to `process.env` so production
   * reads the env-driven HALT / DEGRADED flags. Test rigs override
   * this with a plain object to exercise the kill-state and policy-
   * flag behaviours deterministically.
   */
  readonly envSource?: Readonly<Record<string, string | undefined>>;
  /**
   * Optional override of the tool-registry seed deps. Defaults to a
   * conservative stub set so the registry boots even when concrete
   * domain services have not yet been wired into the kernel. The
   * api-gateway will replace this with real Drizzle adapters in a
   * follow-up.
   */
  readonly seedToolDeps?: SeedBrainToolDeps;
  /**
   * Optional approval-policy resolver. When wired, the kernel's
   * four-eye-approval gate consults per-action role-group policies
   * at propose-time. The api-gateway composition root constructs
   * `createApprovalPolicyService(db)` and threads it in on the LIVE
   * path; the null-path keeps using the legacy default.
   *
   * Typed as `unknown` so this wiring file does not pick up a hard
   * type dependency on `@bossnyumba/database`. The structural shape
   * already matches `ApprovalPolicyResolver` from the kernel; the
   * cast happens at the `composeSovereign` boundary.
   */
  readonly approvalPolicyResolver?: unknown;
  /**
   * Optional sensor-routing service (DB-backed `sensor_call_log`
   * writer + budget-envelope debiter). When wired, the wiring
   * surfaces it via the return slot so downstream consumers
   * (sensor adapters, ops endpoints) can record per-call telemetry
   * to the `sensor_call_log` table. Not consumed inside this
   * wiring itself — kernel-side sensor calls do not yet flow
   * through the routing service; an opt-in adapter lands as a
   * follow-up.
   */
  readonly sensorRoutingService?: SensorRoutingServicePort;
  /**
   * Optional HQ-tier tool registry — when wired, the wiring merges
   * its 12 `platform.*` BrainTools into the kernel's tool registry
   * alongside the 5 PM seed tools (K9). The Central Command admin
   * chat can then invoke them through the same disciplined pipeline
   * (Zod gates, audit-trail, four-eye approval for sovereign tiers).
   *
   * Typed as `unknown` so this file does not pick up a hard dependency
   * on the HQ-tool composition file's structural exports — the merge
   * loop only relies on the `.list()` + `.register()` shape of a
   * BrainToolRegistry.
   */
  readonly hqToolRegistry?: {
    readonly registry: BrainToolRegistry;
    readonly toolNames: ReadonlyArray<`platform.${string}`>;
  };
  /**
   * Phase F.3 — production-grade orchestrator hook-chain bindings.
   *
   * When provided, the wiring constructs the 9-hook PreToolUse /
   * PostToolUse / Stop chain via `buildOrchestratorBindings(...)` and
   * surfaces the assembled HookChain on the return value
   * (`wiring.orchestratorBindings`). The chain is NOT yet threaded into
   * `composeSovereign({ orchestrator: ... })` because the LLM router +
   * dispatcher adapters ship in a separate PR (see service-registry
   * comments on the `agent: null` slot). Once those land, the wiring
   * threads them in along with `bindings.deps` and the kernel's
   * `think()` route flips to the Claude-Code-style main-loop.
   *
   * Typed as `unknown` for the db slot to dodge the namespace-vs-type
   * drift (TS2709) the rest of this composition layer routes around.
   * The structural shape matches `DrizzleLike` in
   * `orchestrator-bindings.ts`.
   */
  readonly orchestratorBindings?: {
    /** Drizzle client (null in degraded mode). */
    readonly db: unknown | null;
    /** Optional caller-supplied tenant id (defaults to platform). */
    readonly tenantId?: string;
    /** Optional global denylist (always-banned tools). */
    readonly globalDenylist?: ReadonlyArray<string>;
    /** Optional approval gate override (defaults to in-memory store). */
    readonly approvalGate?: ApprovalGate;
    /** Optional proposer id for ledger writes. */
    readonly proposer?: string;
  };
}

/**
 * Structural duck-shape of the `SensorRoutingService` from
 * `@bossnyumba/database`. Kept local so this wiring file does not pick
 * up a hard type dependency on the database package. The real
 * `createSensorRoutingService(db)` returns an object matching this
 * shape and is wired by the api-gateway service-registry.
 */
export interface SensorRoutingServicePort {
  recordSensorCall(args: unknown): Promise<{ readonly id: string }>;
  getBudgetStatus(args: unknown): Promise<unknown>;
  selectSensorChain(task: string, tier?: unknown): unknown;
}

export interface BrainKernelWiring {
  readonly kernel: BrainKernel;
  /** Bound `kernel.think` reference safe to pass to other wirings. */
  readonly think: BrainKernel['think'];
  /**
   * Decision-trace recorder constructed at boot. Exposed so the
   * service-registry can surface it to ops UIs / admin routes
   * without re-constructing.
   */
  readonly decisionTraceRecorder: DecisionTraceRecorder;
  /** Env-backed killswitch port the kernel is using. */
  readonly killswitch: KillswitchPort;
  /** Seeded brain-tool registry the kernel is using. */
  readonly toolRegistry: BrainToolRegistry;
  /**
   * Resolved uncertainty-policy mode (`'on'` or `'off'`). Operators
   * flip this via `BOSSNYUMBA_UNCERTAINTY_POLICY=on` once their
   * grounding-facts + judge wiring is in place. Default `'off'` to
   * preserve baseline test contracts.
   */
  readonly uncertaintyPolicy: 'on' | 'off';
  /**
   * Sensor-routing service exposed to downstream consumers when
   * the caller passed one in via `deps.sensorRoutingService`. Null
   * when no DB-backed service was wired.
   */
  readonly sensorRoutingService: SensorRoutingServicePort | null;
  /**
   * Embedder the kernel was composed with. When an OpenAI key was
   * present at boot this is a `createOpenAiEmbedder` instance;
   * otherwise it is `createNullEmbedder()` (always-rejects sentinel
   * the kernel catches and falls back to key-based recall).
   */
  readonly embedder: EmbedderPort;
  /**
   * Phase F.3 — production-grade orchestrator hook-chain bindings.
   * Null when the caller did not pass `deps.orchestratorBindings`.
   * Surfaces `{ hookChain, deps }` so a future composition extension
   * (LLM router + dispatcher adapter) can thread the chain into
   * `composeSovereign({ orchestrator: ... })` and flip kernel.think()
   * onto the Claude-Code-style main loop.
   */
  readonly orchestratorBindings: OrchestratorBindings | null;
}

/**
 * Resolve the uncertainty-policy mode from the env var
 * `BOSSNYUMBA_UNCERTAINTY_POLICY`. Default `'off'`.
 */
function resolveUncertaintyPolicyMode(
  env: Readonly<Record<string, string | undefined>>,
): 'on' | 'off' {
  const raw = env['BOSSNYUMBA_UNCERTAINTY_POLICY'];
  if (!raw) return 'off';
  return raw.trim().toLowerCase() === 'on' ? 'on' : 'off';
}

/**
 * Default seed-tool deps — every executor returns a "not configured"
 * error so the registry boots end-to-end even when no concrete
 * adapter has been wired. The real Drizzle adapters land in a
 * follow-up; until then, the kernel knows the tool exists, the
 * deterministic registry layer enforces the input/output schema,
 * and the executor surfaces a structured failure rather than an
 * undefined return.
 */
function buildPlaceholderSeedToolDeps(): SeedBrainToolDeps {
  const notWired = async (_input: unknown): Promise<never> => {
    throw new Error(
      'brain-kernel: seed tool executor is not yet wired to a domain adapter',
    );
  };
  return {
    lookupTenantArrears: notWired as never,
    checkComplianceCertificate: notWired as never,
    getMarketRateBand: notWired as never,
  };
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

  // Wave-K T1 — env-driven killswitch + always-on decision-trace
  // recorder. Both are constructed BEFORE composeSovereign so we can
  // forward them into the kernel deps and surface them on the wiring
  // return value for the service-registry's ops slots.
  const envSource = deps.envSource ?? process.env;
  const killswitch = createEnvKillswitchPort(envSource);
  const decisionTraceRecorder = createDecisionTraceRecorder({
    store: createInMemoryDecisionTraceStore({ capacity: 200 }),
  });

  // K9 — seed the brain-tool registry. The default seed-deps surface
  // a clear "not yet wired" error; concrete Drizzle adapters land in
  // a follow-up via `deps.seedToolDeps`.
  const toolRegistry = createBrainToolRegistry();
  try {
    registerSeedBrainTools(
      toolRegistry,
      deps.seedToolDeps ?? buildPlaceholderSeedToolDeps(),
    );
  } catch (err) {
    if (deps.logger?.warn) {
      deps.logger.warn(
        {
          wiring: 'brain-kernel',
          error: err instanceof Error ? err.message : String(err),
        },
        'brain-kernel: tool-registry seed failed; continuing with empty registry',
      );
    }
  }

  // C2 — merge the HQ-tier tool registry (12 `platform.*` tools) into
  // the kernel's tool registry. The HQ composition root already
  // registered each tool on a separate registry; here we re-register
  // each adapted spec on the kernel's registry so the kernel's tool-
  // execution loop sees them as a single catalog.
  if (deps.hqToolRegistry) {
    let mergedCount = 0;
    for (const spec of deps.hqToolRegistry.registry.list()) {
      try {
        toolRegistry.register(spec as BrainToolSpec);
        mergedCount += 1;
      } catch (err) {
        if (deps.logger?.warn) {
          deps.logger.warn(
            {
              wiring: 'brain-kernel',
              tool: spec.name,
              error: err instanceof Error ? err.message : String(err),
            },
            'brain-kernel: failed to merge HQ tool into kernel registry',
          );
        }
      }
    }
    if (deps.logger?.info) {
      deps.logger.info(
        {
          wiring: 'brain-kernel',
          hqTools: mergedCount,
          hqToolNames: deps.hqToolRegistry.toolNames,
        },
        'brain-kernel: HQ tools merged into registry',
      );
    }
  }

  // Operators flip this to `'on'` once their grounding-facts + judge
  // wiring is in place. Default `'off'` preserves baseline test
  // contracts in this and consuming wirings.
  const uncertaintyPolicy = resolveUncertaintyPolicyMode(envSource);

  // Wave-K Tier-3 follow-up — resolve the text embedder port. The
  // kernel's memory-recall step prefers `searchByEmbedding` when an
  // embedder is wired; failures collapse to the legacy key-based
  // search inside the kernel. We always thread a port (null-embedder
  // fallback) so the kernel branch is uniform.
  const embedder = resolveEmbedder(envSource, deps.logger);

  let kernel: BrainKernel;
  try {
    const composeArgs: Parameters<typeof composeSovereign>[0] = {
      anthropicClient: anthropicMessagesClient as Parameters<
        typeof composeSovereign
      >[0]['anthropicClient'],
      killswitch,
      traceRecorder: decisionTraceRecorder,
      uncertaintyPolicy,
      toolRegistry,
      embedder,
    };
    if (deps.approvalPolicyResolver) {
      // Structural duck-cast: the database service's
      // `ApprovalPolicyResolver` shape already matches the kernel's
      // duck-typed port.
      (
        composeArgs as { approvalPolicyResolver?: unknown }
      ).approvalPolicyResolver = deps.approvalPolicyResolver;
    }
    const sovereign = composeSovereign(composeArgs);
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

  // Phase F.3 — build the production-grade orchestrator hook-chain
  // bindings. We construct the chain even when the caller did not pass
  // `deps.orchestratorBindings` so the wiring still surfaces a
  // structurally-complete (real-port-bound) chain for diagnostic /
  // future-wiring use. The kernel's `composeSovereign({...})` call
  // above does NOT yet thread the chain in — the LLM router +
  // dispatcher adapters ship as a separate PR. When the caller skips
  // the bindings block, we surface `null` so the audit script doesn't
  // mis-classify the absence as a no-op chain.
  let orchestratorBindings: OrchestratorBindings | null = null;
  if (deps.orchestratorBindings) {
    try {
      const approvalGate =
        deps.orchestratorBindings.approvalGate ??
        createApprovalGate({ store: createInMemoryApprovalStore() });
      const bindingsArgs: Parameters<typeof buildOrchestratorBindings>[0] = {
        db: deps.orchestratorBindings.db,
        approvalGate,
        toolRegistry,
        tenantId: deps.orchestratorBindings.tenantId ?? '_platform',
        env: envSource,
        ...(deps.logger ? { logger: deps.logger } : {}),
        ...(deps.orchestratorBindings.globalDenylist
          ? { globalDenylist: deps.orchestratorBindings.globalDenylist }
          : {}),
        ...(deps.orchestratorBindings.proposer
          ? { proposer: deps.orchestratorBindings.proposer }
          : {}),
      };
      orchestratorBindings = buildOrchestratorBindings(bindingsArgs);
      if (deps.logger?.info) {
        deps.logger.info(
          {
            wiring: 'brain-kernel',
            hooks: orchestratorBindings.hookChain
              .list()
              .map((h) => `${h.name}:${h.stage}`),
            dbBacked: deps.orchestratorBindings.db !== null,
          },
          'brain-kernel: production orchestrator hook chain bound (9 ports)',
        );
      }
    } catch (err) {
      if (deps.logger?.warn) {
        deps.logger.warn(
          {
            wiring: 'brain-kernel',
            error: err instanceof Error ? err.message : String(err),
          },
          'brain-kernel: orchestrator hook-chain bindings failed; continuing without',
        );
      }
    }
  }

  if (deps.logger?.info) {
    deps.logger.info(
      {
        wiring: 'brain-kernel',
        sensors: ['opus47', 'sonnet46', 'haiku45'],
        autoHaikuJudge: true,
        uncertaintyPolicy,
        killswitch: killswitch.readPlatform().level,
        embedder: embedder.modelId,
      },
      'brain-kernel: composed (real-brain path active)',
    );
  }

  return {
    kernel,
    // Bind so callers can pass `wiring.think` as a free function value
    // without losing the `this` reference.
    think: kernel.think.bind(kernel),
    decisionTraceRecorder,
    killswitch,
    toolRegistry,
    uncertaintyPolicy,
    sensorRoutingService: deps.sensorRoutingService ?? null,
    embedder,
    orchestratorBindings,
  };
}

/**
 * Resolve the kernel's text-embedder port. Reads
 * `OPENAI_EMBEDDING_API_KEY` first (operators can split embedding +
 * generation keys), falling back to `OPENAI_API_KEY`. When neither is
 * set we thread the always-rejects `createNullEmbedder()` so the
 * kernel's memory-recall step has a uniform port and its `try/catch`
 * collapses to the legacy key-based search path.
 *
 * Defensive: if `createOpenAiEmbedder` itself throws at construction
 * (e.g. a future regression that requires more config) we log a
 * warning and fall back to the null embedder rather than killing the
 * gateway boot.
 */
function resolveEmbedder(
  envSource: Readonly<Record<string, string | undefined>>,
  logger: BrainKernelWiringDeps['logger'],
): EmbedderPort {
  const apiKey =
    (envSource['OPENAI_EMBEDDING_API_KEY']?.trim() ||
      envSource['OPENAI_API_KEY']?.trim()) ??
    '';
  if (!apiKey) {
    return createNullEmbedder();
  }
  try {
    return createOpenAiEmbedder({ apiKey });
  } catch (err) {
    if (logger?.warn) {
      logger.warn(
        {
          wiring: 'brain-kernel',
          error: err instanceof Error ? err.message : String(err),
        },
        'brain-kernel: embedder construction failed; using null embedder',
      );
    }
    return createNullEmbedder();
  }
}
