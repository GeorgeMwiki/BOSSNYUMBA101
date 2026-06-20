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
 * `voice-agent-wiring.ts` and `bkt-mastery-reader.ts` for the same
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
  orchestrator,
  registerSeedBrainTools,
  type ApprovalGate,
  type ApprovalStore,
  type BrainToolRegistry,
  type BrainToolSpec,
  type DecisionTraceRecorder,
  type EmbedderPort,
  type KillswitchPort,
  type MultiLLMSynthesizerPort,
  type SeedBrainToolDeps,
} from '@bossnyumba/central-intelligence';
import { getModelLatest } from '@bossnyumba/brain-llm-router/dynamic-registry';
import {
  buildOrchestratorBindings,
  type OrchestratorBindings,
} from './orchestrator-bindings.js';

/** The orchestrator's `LLMRouter` port — the main-loop's sensor leg. */
type LLMRouter = orchestrator.LLMRouter;
/** The orchestrator's `Dispatcher` port — the main-loop's actuator. */
type Dispatcher = orchestrator.Dispatcher;
/** The orchestrator's `ToolSearch` port — the main-loop's per-tick tool retriever. */
type ToolSearch = orchestrator.ToolSearch;
/** Goal-similarity descriptor the `ToolSearch` ranks over. */
type ToolDescriptor = orchestrator.ToolDescriptor;

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
   * Optional durable ApprovalStore for the kernel's OWN four-eye gate
   * (the `approvals` gate built inside `composeSovereign`). When wired,
   * `composeSovereign` builds a Drizzle-backed gate that persists
   * proposals across restart/replicas; when omitted it falls back to an
   * in-memory store (compose.ts), which is correct ONLY for dev/tests.
   * The api-gateway composition root constructs
   * `createPgApprovalStore(db, ...)` and threads it in on the LIVE path
   * so production never silently uses the volatile in-memory gate. The
   * structural shape matches the kernel's `ApprovalStore` port.
   */
  readonly approvalStore?: ApprovalStore;
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
   * PostToolUse / Stop chain via `buildOrchestratorBindings(...)` and —
   * when `enableOrchestratorMainLoop` is also set — threads the chain's
   * 9 real ports into `composeSovereign({ orchestrator: ... })` alongside
   * the LLM router + dispatcher adapters. The kernel's `think()` route
   * then flips to the Claude-Code-style main-loop (live-by-default). The
   * assembled HookChain is also surfaced on the return value
   * (`wiring.orchestratorBindings`) for diagnostics.
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
  /**
   * Phase F.3 — LIVE orchestrator wire-up signal.
   *
   * When `true`, the wiring builds the orchestrator's `LLMRouter` from the
   * Anthropic client it already composed (tool_use-preserving) + the
   * `Dispatcher` from the local seeded `toolRegistry`, then threads the
   * `orchestrator` block into `composeSovereign({ orchestrator: ... })`.
   * The kernel's `think()` then routes through the Claude-Code-style
   * main-loop (live-by-default — `useByDefault` left unset → true inside
   * the kernel). When falsy / absent the legacy 13-step pipeline runs.
   *
   * The service-registry sets this to `Boolean(llmRouter)` so the
   * presence of an Anthropic key (which is what makes `llmRouter`
   * non-null) is the single switch that turns the main-loop on.
   */
  readonly enableOrchestratorMainLoop?: boolean;
  /**
   * Optional explicit `LLMRouter` override. When provided it replaces the
   * default Anthropic-SDK router (e.g. to route the main-loop through the
   * MultiLLMRouter cost-cascade). Typed as `unknown` so this wiring file
   * does not pick up a hard type dependency on the orchestrator namespace
   * at the slot boundary; the structural shape must match
   * `orchestrator.LLMRouter`.
   */
  readonly llmRouter?: unknown;
  /**
   * Optional explicit `Dispatcher` override. When provided it replaces the
   * default registry-backed dispatcher. Typed as `unknown` for the same
   * reason as `llmRouter`; the structural shape must match
   * `orchestrator.Dispatcher`.
   */
  readonly dispatcher?: unknown;
  /**
   * PART A — loop actuators. The three ports (`subAgentSpawner`,
   * `scheduler`, `monitorRegistry` + recursion governors) that make the
   * main-loop's `spawn_sub_md` / `schedule_wake` / `monitor` Decisions
   * execute for REAL. Threaded into the DEFAULT registry dispatcher's
   * `loopActuators` config. A null bundle (or a null port within) makes
   * the matching variant degrade gracefully (record + log + ACK). Ignored
   * when a `dispatcher` override is supplied (the override owns its own
   * actuation). Typed as the orchestrator's `LoopActuators` structurally.
   */
  readonly loopActuators?: orchestrator.LoopActuators;
  /**
   * Optional multi-LLM synthesizer port for the kernel's deep-reasoning
   * path. When wired, turns carrying `req.requireSynthesis === true` are
   * routed through a mixture-of-agents fan-out (Anthropic + OpenAI +
   * DeepSeek) plus a Claude-Opus synthesis pass. Null when no viable
   * synthesizer can be built — the kernel keeps the single-shot sensor
   * path with no behavioural change. Built by
   * `createMultiLLMSynthesizerWiring` (see multi-llm-synthesizer-wiring.ts).
   */
  readonly synthesizer?: MultiLLMSynthesizerPort | null;
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
   * Surfaces `{ hookChain, deps }`. When `enableOrchestratorMainLoop` is
   * set these same `deps` ports are threaded into
   * `composeSovereign({ orchestrator: ... })`, so the kernel's
   * `think()` runs the Claude-Code-style main loop with this exact
   * 9-hook chain enforcing policy.
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

  // Phase F.3 — build the production-grade orchestrator hook-chain
  // bindings BEFORE composeSovereign so the 9 real ports (`bindings.deps`)
  // can be threaded into the kernel's `orchestrator` block (the
  // Claude-Code-style main-loop). We construct the chain even when the
  // caller did not pass `deps.orchestratorBindings` so the wiring still
  // surfaces a structurally-complete (real-port-bound) chain for
  // diagnostics. When the caller skips the bindings block, we surface
  // `null` so the audit script doesn't mis-classify the absence as a
  // no-op chain.
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

  // Phase F.3 — resolve the orchestrator's two required ports. The
  // `LLMRouter` defaults to an Anthropic-SDK adapter over the SAME client
  // the sensors use (tool_use-preserving → `Decision`); the `Dispatcher`
  // defaults to a registry-backed actuator over the local seeded
  // `toolRegistry` (zod-gated, audited tool execution through the same
  // catalog the legacy pipeline uses). Either can be overridden by the
  // caller. When the main-loop is not enabled, both stay null and the
  // legacy 13-step pipeline runs.
  const orchestratorPorts = deps.enableOrchestratorMainLoop
    ? resolveOrchestratorPorts({
        anthropicClient: anthropicMessagesClient,
        toolRegistry,
        envSource,
        ...(deps.logger ? { logger: deps.logger } : {}),
        ...(deps.llmRouter !== undefined ? { llmRouterOverride: deps.llmRouter } : {}),
        ...(deps.dispatcher !== undefined
          ? { dispatcherOverride: deps.dispatcher }
          : {}),
        ...(deps.loopActuators !== undefined
          ? { loopActuators: deps.loopActuators }
          : {}),
      })
    : null;

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
    if (deps.synthesizer) {
      // readonly on ComposeSovereignConfig — re-cast through a
      // mutable view to preserve the immutable type on the public
      // surface while still passing the wire in. Mirrors the pattern
      // used by `approvalPolicyResolver` above.
      (composeArgs as { synthesizer?: MultiLLMSynthesizerPort }).synthesizer =
        deps.synthesizer;
    }
    if (deps.approvalPolicyResolver) {
      // Structural duck-cast: the database service's
      // `ApprovalPolicyResolver` shape already matches the kernel's
      // duck-typed port.
      (
        composeArgs as { approvalPolicyResolver?: unknown }
      ).approvalPolicyResolver = deps.approvalPolicyResolver;
    }
    if (deps.approvalStore) {
      // Durable kernel-level four-eye gate. Without this composeSovereign
      // builds its `approvals` gate over an in-memory store (compose.ts),
      // so kernel-proposed approvals would not survive restart and would
      // diverge from the replica-shared approver API. `approvalStore` is
      // readonly on ComposeSovereignConfig — assign through a mutable
      // view (same pattern as `synthesizer` / `approvalPolicyResolver`).
      (composeArgs as { approvalStore?: ApprovalStore }).approvalStore =
        deps.approvalStore;
    }
    // Phase F.3 — LIVE-BY-DEFAULT. When the main-loop is enabled and we
    // obtained a router + dispatcher, thread the `orchestrator` block in,
    // reusing the 9 production hook ports already built in
    // `orchestratorBindings.deps`. `useByDefault` is left UNSET so it
    // defaults TRUE inside the kernel (`resolveOrchestratorRoutingEnabled`):
    // the kernel's `think()` routes through the Claude-Code-style
    // main-loop. When no router could be built (no LLM), we skip the
    // block and the legacy 13-step pipeline runs — graceful degrade,
    // zero hard blockers.
    if (orchestratorPorts) {
      // `orchestrator` is readonly on ComposeSovereignConfig — assign
      // through a mutable view (same pattern as `synthesizer` above).
      (
        composeArgs as {
          orchestrator?: NonNullable<
            Parameters<typeof composeSovereign>[0]['orchestrator']
          >;
        }
      ).orchestrator = buildOrchestratorBlock(
        orchestratorPorts,
        orchestratorBindings,
      );
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

  // Phase F.3 — single boot log recording whether the main-loop is LIVE
  // or the kernel degraded to the legacy pipeline. Pino only (the
  // duck-typed logger the wiring already accepts) — never console.
  if (orchestratorPorts) {
    deps.logger?.info?.(
      {
        wiring: 'brain-kernel',
        router: orchestratorPorts.routerKind,
        dispatcher: orchestratorPorts.dispatcherKind,
        // Number of BrainTools indexed into the main-loop's ToolSearch.
        // Non-zero confirms the live orchestrator can call tools (the
        // residual fix); 0 would mean it degraded to text-only.
        toolSearchSize: orchestratorPorts.toolSearchSize,
        hooks: orchestratorBindings
          ? orchestratorBindings.hookChain.list().length
          : 0,
      },
      'brain-kernel: orchestrator main-loop LIVE (Claude-Code-style)',
    );
  } else {
    deps.logger?.warn?.(
      { wiring: 'brain-kernel' },
      'brain-kernel: orchestrator degraded → legacy pipeline (no LLM router)',
    );
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

// ─────────────────────────────────────────────────────────────────────
// Phase F.3 — orchestrator port resolution.
// ─────────────────────────────────────────────────────────────────────

/**
 * The two required orchestrator ports plus a provenance tag for the boot
 * log (so operators can see whether the default adapters or an injected
 * override is live).
 */
interface ResolvedOrchestratorPorts {
  readonly router: LLMRouter;
  readonly dispatcher: Dispatcher;
  /**
   * Populated `ToolSearch` built from the SAME seeded `BrainToolRegistry`
   * the dispatcher actuates. Without this, the kernel binds its default
   * `createInMemoryToolSearch([])` (EMPTY) — the main-loop's per-tick
   * `searchRelevant(...)` would then find NOTHING and the live
   * orchestrator could only emit text, never a `tool_call`. Threading a
   * populated store here is what gives the live orchestrator full
   * tool-calling powers over the 5 seed + 12 platform BrainTools.
   */
  readonly toolSearch: ToolSearch;
  readonly routerKind: 'anthropic-sdk' | 'override';
  readonly dispatcherKind: 'registry' | 'override';
  /** Number of tool descriptors indexed into the ToolSearch (boot log). */
  readonly toolSearchSize: number;
}

/**
 * Resolve the main-loop's `LLMRouter` + `Dispatcher`.
 *
 * Defaults (production path):
 *   - router     → `createAnthropicLLMRouter` over the same Anthropic
 *                  Messages client the kernel sensors use. Tool_use
 *                  blocks survive into the `Decision` ADT. The model id
 *                  comes from `KERNEL_ORCHESTRATOR_MODEL` (env) or
 *                  `getModelLatest('sonnet')` — never hard-coded.
 *   - dispatcher → `createRegistryDispatcher` over the local seeded
 *                  `BrainToolRegistry` (the SAME catalog the legacy
 *                  pipeline runs; zod-gated + audited per tool).
 *   - toolSearch → `createInMemoryToolSearch` over descriptors derived
 *                  from THAT SAME registry, so the main-loop's per-tick
 *                  `searchRelevant(goal, 8)` can actually surface the
 *                  seed + platform BrainTools to the model. Without it the
 *                  kernel binds an EMPTY default and the live orchestrator
 *                  is text-only (the residual this wiring closes).
 *
 * Overrides (e.g. routing the main-loop through the MultiLLMRouter
 * cost-cascade) are accepted as structurally-typed `unknown` and cast at
 * this boundary. The `toolSearch` always tracks the local registry — a
 * router override does not change which tools the catalog can execute.
 */
function resolveOrchestratorPorts(args: {
  readonly anthropicClient: KernelAnthropicSdkLike;
  readonly toolRegistry: BrainToolRegistry;
  readonly envSource: Readonly<Record<string, string | undefined>>;
  readonly logger?: BrainKernelWiringDeps['logger'];
  readonly llmRouterOverride?: unknown;
  readonly dispatcherOverride?: unknown;
  readonly loopActuators?: orchestrator.LoopActuators;
}): ResolvedOrchestratorPorts {
  const modelId =
    args.envSource['KERNEL_ORCHESTRATOR_MODEL']?.trim() ||
    getModelLatest('sonnet');

  const router: LLMRouter =
    args.llmRouterOverride !== undefined
      ? (args.llmRouterOverride as LLMRouter)
      : orchestrator.createAnthropicLLMRouter(
          // The kernel's `KernelAnthropicSdkLike` shape (messages.create)
          // is a structural subset of the adapter's `AnthropicRouterClient`.
          args.anthropicClient as orchestrator.AnthropicRouterClient,
          {
            modelId,
            ...(args.logger?.warn
              ? {
                  logger: {
                    warn: (msg: string, meta?: Record<string, unknown>): void =>
                      args.logger?.warn?.({ wiring: 'brain-kernel', ...meta }, msg),
                  },
                }
              : {}),
          },
        );

  const dispatcher: Dispatcher =
    args.dispatcherOverride !== undefined
      ? (args.dispatcherOverride as Dispatcher)
      : orchestrator.createRegistryDispatcher(args.toolRegistry, {
          ...(args.logger?.warn
            ? {
                logger: {
                  warn: (msg: string, meta?: Record<string, unknown>): void =>
                    args.logger?.warn?.({ wiring: 'brain-kernel', ...meta }, msg),
                  ...(args.logger?.info
                    ? {
                        info: (msg: string, meta?: Record<string, unknown>): void =>
                          args.logger?.info?.({ wiring: 'brain-kernel', ...meta }, msg),
                      }
                    : {}),
                },
              }
            : {}),
          // PART A — REAL loop actuation. When the composition root wires
          // the durable (Inngest-backed) actuators, the dispatcher executes
          // spawn_sub_md / schedule_wake / monitor for real; a null bundle
          // (or a null port within) degrades that variant gracefully.
          ...(args.loopActuators !== undefined
            ? { loopActuators: args.loopActuators }
            : {}),
        });

  // Build a POPULATED ToolSearch from the SAME seeded registry the
  // dispatcher actuates. This is the residual fix: the kernel's default
  // `createInMemoryToolSearch([])` is EMPTY, so the main-loop could only
  // emit text. Indexing the registry's catalog here lets the per-tick
  // `searchRelevant(...)` surface the seed + platform BrainTools so the
  // live orchestrator can call them — full tool-calling parity.
  const descriptors = buildToolDescriptorsFromRegistry(args.toolRegistry);
  const toolSearch: ToolSearch = orchestrator.createInMemoryToolSearch(descriptors);

  return {
    router,
    dispatcher,
    toolSearch,
    routerKind: args.llmRouterOverride !== undefined ? 'override' : 'anthropic-sdk',
    dispatcherKind:
      args.dispatcherOverride !== undefined ? 'override' : 'registry',
    toolSearchSize: descriptors.length,
  };
}

/**
 * Map every `BrainToolSpec` in the seeded registry onto the orchestrator's
 * `ToolDescriptor` shape so the main-loop's `ToolSearch` can rank them by
 * goal-similarity.
 *
 * `ToolDescriptor` carries `name` + `description` + `keywords` (+ optional
 * `sampleArgs`) — it has NO JSON-schema field, so per-tool argument
 * guidance cannot ride on the descriptor (see RESIDUAL note below). The
 * keyword-overlap ranker (`createInMemoryToolSearch`) matches the goal text
 * against `[...keywords, ...tokenise(description)]`, so we seed `keywords`
 * from the tool NAME tokens (the description is already tokenised by the
 * ranker) plus the zod input schema's top-level field names — which makes
 * a tool retrievable by the vocabulary of its own arguments
 * (e.g. `tenantProfileId`, `certificateId`).
 *
 * Residual #2 (tool input schemas): a `BrainToolSpec` DOES carry a zod
 * `schemaIn`, but the `ToolDescriptor` has nowhere to put a JSON schema and
 * the Anthropic router adapter already advertises a permissive
 * `{type:'object', additionalProperties:true}` schema for every tool (see
 * `anthropic-llm-router.ts:PERMISSIVE_TOOL_SCHEMA`). We therefore surface
 * the schema's field NAMES as `keywords`/`sampleArgs` (retrieval guidance)
 * rather than inventing a JSON schema. The dispatcher's `registry.runTool`
 * zod gate still enforces the real per-tool contract at execution time.
 */
function buildToolDescriptorsFromRegistry(
  registry: BrainToolRegistry,
): ReadonlyArray<ToolDescriptor> {
  return registry.list().map((spec) => {
    const fieldNames = extractSchemaFieldNames(spec.schemaIn);
    const keywords = Array.from(
      new Set([...tokeniseToolName(spec.name), ...fieldNames]),
    );
    return {
      name: spec.name,
      description: spec.description,
      keywords,
      // Concatenated into the (embedding) corpus + matched by the keyword
      // ranker via tokenisation of the description — argument names help a
      // goal phrased in the tool's own vocabulary retrieve it.
      ...(fieldNames.length > 0 ? { sampleArgs: fieldNames } : {}),
    };
  });
}

/**
 * Split a camelCase / dotted tool name into lowercase keyword tokens so
 * the overlap ranker can match a natural-language goal against it
 * (e.g. `lookupTenantArrears` → `lookup`, `tenant`, `arrears`;
 * `platform.tenant.suspend` → `platform`, `tenant`, `suspend`). Tokens
 * shorter than 3 chars are dropped to mirror the ranker's own
 * `tokenise` (which ignores <3-char words).
 */
function tokeniseToolName(name: string): ReadonlyArray<string> {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2);
}

/**
 * Best-effort extraction of the top-level field names from a zod object
 * schema. Used ONLY to enrich `ToolDescriptor` retrieval keywords — NOT to
 * build a JSON schema. Non-object schemas (unions, primitives) and any
 * shape we can't introspect collapse to an empty list; the tool stays
 * retrievable by its name + description tokens. We read `_def.shape`
 * defensively (zod's internal) and never throw.
 */
function extractSchemaFieldNames(schema: unknown): ReadonlyArray<string> {
  try {
    const def = (schema as { _def?: { shape?: unknown } })?._def;
    const shape = typeof def?.shape === 'function'
      ? (def.shape as () => Record<string, unknown>)()
      : (def?.shape as Record<string, unknown> | undefined);
    if (!shape || typeof shape !== 'object') return [];
    return Object.keys(shape).filter((k) => k.length > 0);
  } catch {
    return [];
  }
}

/**
 * Build the `composeSovereign({ orchestrator })` block. Reuses the 9
 * production hook ports already constructed in `orchestratorBindings.deps`
 * (PII → permission → four-eye → denylist → rate → cost → sandbox →
 * audit → ledger-seal) so the main-loop enforces IDENTICAL policy to the
 * production hook chain.
 *
 * `toolSearch` is threaded in explicitly (built from the seeded registry in
 * `resolveOrchestratorPorts`) so the main-loop's per-tick
 * `searchRelevant(...)` surfaces the real BrainTool catalog instead of the
 * kernel's EMPTY `createInMemoryToolSearch([])` default. The remaining
 * orchestrator-side stores (plan / session / context-budget / memory) fall
 * to the kernel's in-memory defaults — those carry no per-tenant policy and
 * no tool catalog.
 *
 * `useByDefault` is deliberately UNSET → the kernel defaults it TRUE, so
 * the main-loop is LIVE BY DEFAULT in this production composition.
 */
function buildOrchestratorBlock(
  ports: ResolvedOrchestratorPorts,
  bindings: OrchestratorBindings | null,
): NonNullable<Parameters<typeof composeSovereign>[0]['orchestrator']> {
  const block: {
    router: LLMRouter;
    dispatcher: Dispatcher;
    toolSearch: ToolSearch;
    piiScrubber?: OrchestratorBindings['deps']['piiScrubber'];
    toolScopes?: OrchestratorBindings['deps']['toolScopes'];
    approvalPolicy?: OrchestratorBindings['deps']['approvalPolicy'];
    toolDenylist?: {
      globalDenylist?: ReadonlyArray<string>;
      dynamic?: OrchestratorBindings['deps']['toolDenylist'];
    };
    rateLimit?: {
      counter?: OrchestratorBindings['deps']['rateLimitCounter'];
      maxCallsPerWindow?: number;
      windowMs?: number;
    };
    costCircuit?: OrchestratorBindings['deps']['costCircuit'];
    sandboxResolver?: OrchestratorBindings['deps']['sandboxResolver'];
    auditSink?: OrchestratorBindings['deps']['auditSink'];
    ledgerSeal?: OrchestratorBindings['deps']['ledgerSeal'];
  } = {
    router: ports.router,
    dispatcher: ports.dispatcher,
    toolSearch: ports.toolSearch,
  };

  // Reuse the already-built 9 production ports. When the bindings block
  // is absent (caller did not pass `orchestratorBindings`), the kernel's
  // own in-memory defaults bind — still a working, fail-closed main-loop.
  if (bindings) {
    const d = bindings.deps;
    block.piiScrubber = d.piiScrubber;
    block.toolScopes = d.toolScopes;
    block.approvalPolicy = d.approvalPolicy;
    block.toolDenylist = {
      dynamic: d.toolDenylist,
      ...(d.globalDenylist ? { globalDenylist: d.globalDenylist } : {}),
    };
    block.rateLimit = {
      counter: d.rateLimitCounter,
      maxCallsPerWindow: d.rateLimitConfig.maxCallsPerWindow,
      windowMs: d.rateLimitConfig.windowMs,
    };
    block.costCircuit = d.costCircuit;
    block.sandboxResolver = d.sandboxResolver;
    block.auditSink = d.auditSink;
    block.ledgerSeal = d.ledgerSeal;
  }

  return block as NonNullable<
    Parameters<typeof composeSovereign>[0]['orchestrator']
  >;
}
