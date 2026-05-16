/**
 * HQ-tool registry composition — wires the 12 `platform.*` BrainTools
 * onto a `BrainToolRegistry` at api-gateway boot.
 *
 * The composition root has two responsibilities:
 *
 *   1. Build the concrete port-adapter set the HQ tools need (tenants
 *      service, users service, feature-flag service, killswitch
 *      writer, invoice adapter, announcement adapter, etc.).
 *   2. Supply the `HqToolContextFactory` — the per-call function the
 *      adapter invokes to capture caller identity, RBAC scopes, the
 *      pre-resolved four-eye approval-record id, the OTel + sovereign-
 *      ledger ports, and the clock.
 *
 * Today, several of these adapters are NOT yet wired to real backends.
 * We thread `NOT_YET_WIRED` stubs that surface a clear "subsystem not
 * available" refusal so the registry boots end-to-end and the admin
 * chat receives a deterministic error instead of an internal crash.
 * Each NOT_YET_WIRED adapter is annotated with the TODO that lands the
 * real Drizzle wiring.
 */

import {
  createBrainToolRegistry,
  hqTools,
  type BrainToolAuditSink,
  type BrainToolRegistry,
  type HqOtelSpanRecorder,
  type HqSovereignLedgerSink,
  type HqToolContext,
} from '@bossnyumba/central-intelligence';
// Central Command Phase B B1 — Drizzle-backed platform.* service
// adapters. Each factory satisfies one (or two) HQ tool port slots; this
// file's `buildHqDepsFromDb` composes them into the full
// SeedHqBrainToolsDeps bundle.
import {
  createPlatformAnnouncementService,
  createPlatformFeatureFlagsService,
  createPlatformInvoiceAdjustmentService,
  createPlatformKillswitchWriteService,
  createPlatformTenantsService,
  createPlatformUsersService,
  createConsolidationRunnerService,
  createDecisionTraceQueryService,
  createServiceHeartbeatService,
  createDatabaseClient,
} from '@bossnyumba/database';
// `DatabaseClient` resolves as a namespace when pulled through the
// package barrel under NodeNext (TS2709) — derive from the factory.
// The other deps interfaces use the same dodge but `Parameters<typeof
// fn>[N]` collapses to `{}` when the source-types path crosses the
// package boundary under NodeNext + isolatedModules, so we mirror the
// shapes locally instead. The kernel-side port surfaces (HQ tools) and
// B1's adapters both expose these as flat interfaces — keeping a local
// copy stays in lockstep with B1's exports.
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

interface PlatformConsolidationWorkerLike {
  runOnce(args: {
    readonly tenantId: string | null;
    readonly dryRun: boolean;
  }): Promise<unknown>;
  rollbackSnapshot(snapshotId: string): Promise<void>;
}
interface PlatformDecisionTraceRecorderLike {
  /** Mirrors `DecisionTraceRecorderLike` in
   *  `packages/database/src/services/platform/decision-trace-query.service.ts`. */
  getRecentTraces(args: {
    tenantId?: string | null;
    limit?: number;
  }): ReadonlyArray<unknown> | Promise<ReadonlyArray<unknown>>;
}
type PlatformKillswitchPublishEvent = (event: {
  readonly type: 'killswitch:changed';
  readonly scope: 'platform' | `tenant:${string}`;
  readonly level: 'live' | 'degraded' | 'halt';
  readonly reasonCode: string;
  readonly setAt: string;
}) => Promise<void> | void;
interface PlatformKillswitchDeps {
  readonly resolveActor: () => string;
  readonly publishCrossPortalEvent?: PlatformKillswitchPublishEvent;
}
interface PlatformNotificationDispatcherLike {
  dispatch(args: unknown): Promise<unknown>;
}
interface PlatformRecipientResolverLike {
  countRecipients(args: unknown): Promise<number>;
}
interface PlatformAnnouncementDeps {
  readonly resolveActor: () => string;
  readonly dispatcher?: PlatformNotificationDispatcherLike;
  readonly recipientResolver?: PlatformRecipientResolverLike;
}
interface PlatformServiceHealthRow {
  readonly serviceName: string;
  readonly state: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly lastHeartbeatAt: string | null;
  readonly latencyMsP95: number | null;
  readonly notes: string | null;
}
interface PlatformServiceHeartbeatDeps {
  readonly uptimeMs?: () => number;
  readonly extraProbes?: ReadonlyArray<() => Promise<PlatformServiceHealthRow>>;
  readonly dbProbeTimeoutMs?: number;
}

/**
 * Convenience alias — the `HqToolContextFactory` shape lives under the
 * `hqTools` namespace export but the rest of this file reads cleaner
 * with a top-level type alias.
 */
type HqToolContextFactory = hqTools.HqToolContextFactory;

// Re-export the deps interface from the kernel barrel for downstream
// callers (service-registry) to feed in real adapters when they land.
export type SeedHqBrainToolsDeps = hqTools.SeedHqBrainToolsDeps;

export interface HqCallerResolver {
  /**
   * Resolve the caller identity + scopes for the in-flight admin
   * request. The api-gateway has already authenticated upstream
   * (Stack Auth / OIDC); the resolver simply extracts the bound
   * principal from the request context object.
   */
  resolve(): { callerId: string; scopes: ReadonlyArray<string> };
}

export interface HqToolRegistryWiringDeps {
  /**
   * Concrete deps for the 12 HQ tools. The api-gateway constructs
   * each port adapter from the database service-registry and threads
   * them through. When `null`, we fall back to NOT_YET_WIRED stubs so
   * the registry still boots.
   *
   * Prefer the `db` shortcut (below) when running against a live DB —
   * `buildHqDepsFromDb(db, callerResolver)` composes the full bundle
   * from B1's Drizzle services in one call.
   */
  readonly hqDeps?: Omit<
    hqTools.SeedHqBrainToolsDeps,
    'contextFactory' | 'maxAdjustmentUsdCents' | 'maxRecipientCount'
  >;
  /**
   * Optional Drizzle client — when supplied AND `hqDeps` is not
   * supplied, the registry calls {@link buildHqDepsFromDb} to compose
   * the full deps bundle from B1's `platform.*` adapters.
   */
  readonly db?: DatabaseClient | null;
  /**
   * Optional consolidation worker for `platform.run_consolidation_tick`.
   * When omitted the consolidation port surfaces a "not yet wired"
   * refusal — same as the legacy NotYetWiredError stub. The actual
   * worker lives in `services/consolidation-worker`; the api-gateway
   * either invokes it in-process or over HTTP via this port.
   */
  readonly consolidationWorker?: PlatformConsolidationWorkerLike | null;
  /**
   * Optional decision-trace recorder for `platform.list_recent_traces`.
   * When omitted, B1's adapter returns `[]` so the HQ tool still shapes
   * cleanly (no traces yet = empty list).
   */
  readonly decisionTraceRecorder?: PlatformDecisionTraceRecorderLike | null;
  /**
   * Optional cross-portal event publisher. When supplied, B1's
   * killswitch adapter fires a `killswitch:changed` event every time
   * the state is updated so all running brains pick up the new state
   * immediately. The api-gateway wires this from
   * `registry.crossPortalBus` (see `service-registry.ts`).
   */
  readonly publishCrossPortalEvent?: PlatformKillswitchDeps['publishCrossPortalEvent'];
  /**
   * Optional announcement-side dispatcher + recipient resolver. When
   * omitted the row is queued only (no email/banner fan-out) and the
   * recipient count defaults to 0.
   */
  readonly announcementDispatcher?: PlatformAnnouncementDeps['dispatcher'];
  readonly announcementRecipientResolver?: PlatformAnnouncementDeps['recipientResolver'];
  /**
   * Optional extra heartbeat probes (redis, consolidation-worker,
   * wake-loop). B1's adapter always synthesises `api-gateway` +
   * `postgres-primary` rows; extras append after those.
   */
  readonly heartbeatExtraProbes?: PlatformServiceHeartbeatDeps['extraProbes'];
  /** Hard cost ceiling for `platform.adjust_invoice` (USD cents). */
  readonly maxAdjustmentUsdCents?: number;
  /** Hard recipient ceiling for `platform.send_announcement`. */
  readonly maxRecipientCount?: number;
  /** Caller-identity resolver — required to bind scopes to each call. */
  readonly callerResolver: HqCallerResolver;
  /** Optional OTel span recorder — wired when @opentelemetry/api is. */
  readonly otel?: HqOtelSpanRecorder | null;
  /** Sovereign-action ledger — destroy/billing/external-comm calls land here. */
  readonly sovereignLedger?: HqSovereignLedgerSink | null;
  /** Optional clock override for tests. */
  readonly clock?: () => Date;
  /** Optional structured logger. */
  readonly logger?: {
    readonly info?: (meta: object, msg: string) => void;
    readonly warn?: (meta: object, msg: string) => void;
  };
  /** Audit sink threaded into the underlying BrainToolRegistry. */
  readonly auditSink?: BrainToolAuditSink | null;
  /**
   * Resolver for the four-eye approval-record id bound to the in-
   * flight call. Returns `null` when no approval was attached
   * (e.g. read-tier or mutate-tier calls). The composition root threads
   * the real ApprovalGate lookup; tests pass a fixed stub.
   */
  readonly approvalRecordIdResolver?: (
    toolName: `platform.${string}`,
  ) => string | null;
}

export interface HqToolRegistryWiring {
  readonly registry: BrainToolRegistry;
  /**
   * The names of the tools registered. 12 today; will grow as we add
   * `platform.*` vocabulary.
   */
  readonly toolNames: ReadonlyArray<`platform.${string}`>;
}

const DEFAULT_MAX_ADJUSTMENT_USD_CENTS = 500_00; // $500 hard ceiling
const DEFAULT_MAX_RECIPIENT_COUNT = 10_000;

/**
 * Compose the HQ tool registry. Returns a fully-seeded
 * `BrainToolRegistry` containing the 12 `platform.*` tools, ready to
 * be merged into the kernel's tool registry via `brain-kernel-wiring`.
 */
export function createHqToolRegistry(
  deps: HqToolRegistryWiringDeps,
): HqToolRegistryWiring {
  const registry = createBrainToolRegistry({
    ...(deps.auditSink ? { auditSink: deps.auditSink } : {}),
  });

  const contextFactory: HqToolContextFactory = (
    toolName: `platform.${string}`,
  ): HqToolContext => {
    const principal = deps.callerResolver.resolve();
    return {
      caller: {
        callerId: principal.callerId,
        scopes: principal.scopes,
      },
      approvalRecordId: deps.approvalRecordIdResolver
        ? deps.approvalRecordIdResolver(toolName)
        : null,
      otel: deps.otel ?? null,
      sovereignLedger: deps.sovereignLedger ?? null,
      clock: deps.clock ?? (() => new Date()),
    };
  };

  // Resolve the concrete deps:
  //   1. Explicit `hqDeps` wins (used by tests + advanced wiring).
  //   2. Otherwise, when `db` is supplied, B1's Drizzle adapters are
  //      composed via {@link buildHqDepsFromDb}.
  //   3. Otherwise, fall back to NOT_YET_WIRED stubs (legacy degraded
  //      path — keeps the registry bootable for unit tests).
  let hqDeps:
    | Omit<
        hqTools.SeedHqBrainToolsDeps,
        'contextFactory' | 'maxAdjustmentUsdCents' | 'maxRecipientCount'
      >
    | null = null;
  let depsSource: 'explicit' | 'db' | 'stub' = 'stub';
  if (deps.hqDeps) {
    hqDeps = deps.hqDeps;
    depsSource = 'explicit';
  } else if (deps.db) {
    hqDeps = buildHqDepsFromDb(deps.db, {
      callerResolver: deps.callerResolver,
      ...(deps.consolidationWorker
        ? { consolidationWorker: deps.consolidationWorker }
        : {}),
      ...(deps.decisionTraceRecorder
        ? { decisionTraceRecorder: deps.decisionTraceRecorder }
        : {}),
      ...(deps.publishCrossPortalEvent
        ? { publishCrossPortalEvent: deps.publishCrossPortalEvent }
        : {}),
      ...(deps.announcementDispatcher
        ? { announcementDispatcher: deps.announcementDispatcher }
        : {}),
      ...(deps.announcementRecipientResolver
        ? {
            announcementRecipientResolver:
              deps.announcementRecipientResolver,
          }
        : {}),
      ...(deps.heartbeatExtraProbes
        ? { heartbeatExtraProbes: deps.heartbeatExtraProbes }
        : {}),
    });
    depsSource = 'db';
  } else {
    hqDeps = buildNotYetWiredHqDeps();
    depsSource = 'stub';
  }

  const seeded: hqTools.SeedHqBrainToolsDeps = {
    ...hqDeps,
    maxAdjustmentUsdCents:
      deps.maxAdjustmentUsdCents ?? DEFAULT_MAX_ADJUSTMENT_USD_CENTS,
    maxRecipientCount: deps.maxRecipientCount ?? DEFAULT_MAX_RECIPIENT_COUNT,
    contextFactory,
  };

  const toolNames = hqTools.seedHqBrainTools(registry, seeded);

  if (deps.logger?.info) {
    deps.logger.info(
      {
        wiring: 'hq-tool-registry',
        toolCount: toolNames.length,
        depsSource,
        usingStubs: depsSource === 'stub',
      },
      'hq-tool-registry: composed',
    );
  }

  return { registry, toolNames };
}

// ─────────────────────────────────────────────────────────────────────
// buildHqDepsFromDb — compose the SeedHqBrainToolsDeps bundle from
// B1's Drizzle-backed `platform.*` adapters.
// ─────────────────────────────────────────────────────────────────────

export interface BuildHqDepsFromDbOptions {
  /** Required — used to source the caller id for write-side adapters
   *  (killswitch.set_by, announcements.created_by, etc.). */
  readonly callerResolver: HqCallerResolver;
  readonly consolidationWorker?: PlatformConsolidationWorkerLike;
  readonly decisionTraceRecorder?: PlatformDecisionTraceRecorderLike;
  readonly publishCrossPortalEvent?: PlatformKillswitchDeps['publishCrossPortalEvent'];
  readonly announcementDispatcher?: PlatformAnnouncementDeps['dispatcher'];
  readonly announcementRecipientResolver?: PlatformAnnouncementDeps['recipientResolver'];
  readonly heartbeatExtraProbes?: PlatformServiceHeartbeatDeps['extraProbes'];
}

/**
 * Compose the full HQ deps bundle from B1's Drizzle services.
 *
 * Three notes on port re-use:
 *   - `tenantsService` satisfies BOTH `tenantsList` (list_tenants) AND
 *     `tenantsCreate` (create_tenant) — the underlying service exposes
 *     the union of the two port surfaces.
 *   - `usersService` satisfies BOTH `usersList` and `usersCreate`.
 *   - Ports that B1 has not shipped yet (`tracesQuery` with no recorder,
 *     `consolidation` with no worker) get a structurally-correct empty
 *     adapter instead of throwing so the HQ tool still shapes cleanly.
 */
export function buildHqDepsFromDb(
  db: DatabaseClient,
  options: BuildHqDepsFromDbOptions,
): Omit<
  hqTools.SeedHqBrainToolsDeps,
  'contextFactory' | 'maxAdjustmentUsdCents' | 'maxRecipientCount'
> {
  const resolveActor: () => string = () =>
    options.callerResolver.resolve().callerId;

  // Tenants service satisfies tenantsList + tenantsCreate.
  const tenantsService = createPlatformTenantsService(db);
  // Users service satisfies usersList + usersCreate (carries its own
  // `tenantExists` so no cross-service plumbing needed).
  const usersService = createPlatformUsersService(db);
  const flagsService = createPlatformFeatureFlagsService(db, { resolveActor });
  const killswitchService = createPlatformKillswitchWriteService(db, {
    resolveActor,
    ...(options.publishCrossPortalEvent
      ? { publishCrossPortalEvent: options.publishCrossPortalEvent }
      : {}),
  });
  const heartbeatService = createServiceHeartbeatService(
    db,
    options.heartbeatExtraProbes
      ? { extraProbes: options.heartbeatExtraProbes }
      : undefined,
  );
  const invoiceService = createPlatformInvoiceAdjustmentService(db, {
    resolveActor,
  });
  const announcementService = createPlatformAnnouncementService(db, {
    resolveActor,
    ...(options.announcementDispatcher
      ? { dispatcher: options.announcementDispatcher }
      : {}),
    ...(options.announcementRecipientResolver
      ? { recipientResolver: options.announcementRecipientResolver }
      : {}),
  });

  // Optional decision-trace recorder + consolidation worker. When
  // omitted the adapter surfaces a clean empty / refusal — see
  // `emptyDecisionTraceQuery` / `notYetWiredConsolidationRunner` below.
  const tracesQuery = options.decisionTraceRecorder
    ? createDecisionTraceQueryService(options.decisionTraceRecorder)
    : emptyDecisionTraceQuery();
  const consolidation = options.consolidationWorker
    ? createConsolidationRunnerService(options.consolidationWorker)
    : notYetWiredConsolidationRunner();

  return {
    tenantsList: tenantsService,
    usersList: usersService,
    heartbeats: heartbeatService,
    tracesQuery,
    flagsRead: flagsService,
    tenantsCreate: tenantsService,
    usersCreate: usersService,
    flagsWrite: flagsService,
    consolidation,
    killswitchWrite: killswitchService,
    invoices: invoiceService,
    announcements: announcementService,
  };
}

/**
 * Structural placeholder for `tracesQuery` when no recorder is wired.
 * Returns empty rows so the HQ tool still shapes cleanly.
 */
function emptyDecisionTraceQuery(): hqTools.SeedHqBrainToolsDeps['tracesQuery'] {
  return {
    async listRecent() {
      return [];
    },
  };
}

/**
 * Structural placeholder for `consolidation` when no worker is wired.
 * `runTick` throws so the executor surfaces a clean executor-failure;
 * `rollbackToSnapshot` also throws (no snapshot is reachable without a
 * worker either).
 */
function notYetWiredConsolidationRunner(): hqTools.SeedHqBrainToolsDeps['consolidation'] {
  return {
    async runTick() {
      throw new NotYetWiredError(
        'consolidation.runTick (no consolidationWorker bound)',
      );
    },
    async rollbackToSnapshot() {
      throw new NotYetWiredError(
        'consolidation.rollbackToSnapshot (no consolidationWorker bound)',
      );
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// NOT_YET_WIRED stubs — surface a deterministic "subsystem not yet
// available" failure rather than crashing the registry. Each stub is
// the smallest legal implementation of its port that returns / throws
// in a way the per-tool refusal layer can translate into a clean error.
// ─────────────────────────────────────────────────────────────────────

class NotYetWiredError extends Error {
  constructor(adapter: string) {
    super(`hq-tool: ${adapter} adapter not yet wired in api-gateway`);
    this.name = 'NotYetWiredError';
  }
}

function buildNotYetWiredHqDeps(): Omit<
  hqTools.SeedHqBrainToolsDeps,
  'contextFactory' | 'maxAdjustmentUsdCents' | 'maxRecipientCount'
> {
  // Retained for unit tests that exercise the registry without a DB.
  // Production callers should pass `db` into `createHqToolRegistry` so
  // {@link buildHqDepsFromDb} composes B1's Drizzle-backed adapters
  // from `packages/database/src/services/platform/`. The kernel-side
  // per-tool refusal layer translates every NotYetWiredError thrown
  // here into a clean `executor-failed` reason so the admin chat sees
  // a precise "subsystem not yet wired" message instead of a 500.
  return {
    tenantsList: {
      async listTenants() {
        throw new NotYetWiredError('tenantsList');
      },
    },
    usersList: {
      async listUsers() {
        throw new NotYetWiredError('usersList');
      },
    },
    heartbeats: {
      async readSnapshot() {
        // Return a minimal "unknown" snapshot so health probes don't
        // throw — operators see a useful "everything unknown" rather
        // than a 500.
        return [
          {
            serviceName: 'api-gateway',
            state: 'unknown',
            lastHeartbeatAt: null,
            latencyMsP95: null,
            notes: 'heartbeat port not yet wired',
          },
        ];
      },
    },
    tracesQuery: {
      async listRecent() {
        return [];
      },
    },
    flagsRead: {
      async read(flagName: string) {
        return {
          flagName,
          globalValue: null,
          tenantOverrides: [],
        };
      },
    },
    tenantsCreate: {
      async slugExists() {
        return false;
      },
      async provisionTenant() {
        throw new NotYetWiredError('tenantsCreate');
      },
      async rollbackTenantProvision() {
        throw new NotYetWiredError('tenantsCreate.rollback');
      },
    },
    usersCreate: {
      async tenantExists() {
        return false;
      },
      async emailExistsOnTenant() {
        return false;
      },
      async createUser() {
        throw new NotYetWiredError('usersCreate');
      },
      async deactivateUser() {
        throw new NotYetWiredError('usersCreate.deactivate');
      },
    },
    flagsWrite: {
      async setFlag() {
        throw new NotYetWiredError('flagsWrite');
      },
      async restoreFlag() {
        throw new NotYetWiredError('flagsWrite.restore');
      },
    },
    consolidation: {
      async runTick() {
        throw new NotYetWiredError('consolidation');
      },
      async rollbackToSnapshot() {
        throw new NotYetWiredError('consolidation.rollback');
      },
    },
    killswitchWrite: {
      async writeKillswitch() {
        throw new NotYetWiredError('killswitchWrite');
      },
      async restoreKillswitch() {
        throw new NotYetWiredError('killswitchWrite.restore');
      },
    },
    invoices: {
      async loadInvoice() {
        return null;
      },
      async applyAdjustment() {
        throw new NotYetWiredError('invoices');
      },
      async reverseAdjustment() {
        throw new NotYetWiredError('invoices.reverse');
      },
    },
    announcements: {
      async send() {
        throw new NotYetWiredError('announcements');
      },
      async recall() {
        throw new NotYetWiredError('announcements.recall');
      },
    },
  };
}
