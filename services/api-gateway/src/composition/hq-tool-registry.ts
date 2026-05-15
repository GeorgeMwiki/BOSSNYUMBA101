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
   */
  readonly hqDeps?: Omit<
    hqTools.SeedHqBrainToolsDeps,
    'contextFactory' | 'maxAdjustmentUsdCents' | 'maxRecipientCount'
  >;
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

  const hqDeps = deps.hqDeps ?? buildNotYetWiredHqDeps();

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
        usingStubs: !deps.hqDeps,
      },
      'hq-tool-registry: composed',
    );
  }

  return { registry, toolNames };
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
  // TODO(C2-followup): replace each adapter with the real
  // database-service-backed port. Pattern: import the relevant
  // service from `@bossnyumba/database` via the api-gateway service
  // registry and pass it in via `HqToolRegistryWiringDeps.hqDeps`.
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
