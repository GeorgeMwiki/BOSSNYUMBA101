/**
 * Wave-3-int2 — Dispatch-router + ESTATE handler-set composition.
 *
 * Wires:
 *   - dispatch-router primitives (already provided by piece-l's
 *     brain-tab-loop-wiring)
 *   - the 5 ESTATE accept-proposal handlers
 *   - a tenant-override routing-rules loader (in-memory default; the
 *     Drizzle-backed loader is a follow-up so this file stays
 *     build-light at CI time)
 *   - the post-kernel.think capture hook
 *
 * Consumers attach `postThinkCaptureHook` to every `kernel.think()` call
 * site (today: the /think + /stream routes in `jarvis-router-factory`).
 * The hook is fire-and-forget so it adds zero latency to the user reply.
 *
 * The pattern mirrors `brain-tab-loop-wiring.ts` from piece-l but
 * upgrades to use the unified `runDispatchPipeline` (OTel-instrumented,
 * tenant-override aware, bulk-op safety enforced) and registers the
 * REAL handler registry instead of the stub.
 */

import {
  capture,
  createInMemoryAuditChainSink,
  createInMemoryCanonicalResolver,
  createInMemoryCaptureStore,
  createInMemoryEventLogStore,
  createInMemoryProposalStore,
  createInMemoryRoutingRulesLoader,
  createIntentClassifier,
  runDispatchPipeline,
  type AcceptHandlerRegistry,
  type AuditChainSink,
  type CaptureInput,
  type CaptureResult,
  type ConversationCaptureStore,
  type InMemoryResolverStore,
  type InMemoryRoutingRulesStore,
  type ModuleUpdateProposal,
  type ModuleUpdateProposalStore,
  type RoutingRulesLoader,
  type TabEventLogStore,
} from '@bossnyumba/dispatch-router';
import {
  buildEstateHandlerSet,
  createModuleHandlerRegistry,
  type EstateHandlerDeps,
} from '@bossnyumba/module-templates';
import { createDrizzleDispatchStores } from './drizzle-proposal-store.js';

// ─── Public type ──────────────────────────────────────────────────────────

export interface DispatchRouterWiring {
  /**
   * Single post-kernel-turn hook. Pass every `kernel.think()` result here.
   *
   * Returns the proposals that were dispatched + the synthetic capture so
   * the caller can include the capture id in the assistant response (e.g.
   * "I drafted a lease application — see proposal X"). Refusals are
   * dropped by the underlying `capture()` step.
   */
  readonly postThinkCaptureHook: (
    input: CaptureInput,
  ) => Promise<{
    readonly capture: CaptureResult;
    readonly proposals: ReadonlyArray<ModuleUpdateProposal>;
  }>;

  /** Resolver-store accessor for dev seeding (e.g. owner-portal demo). */
  readonly resolverStore: InMemoryResolverStore;

  /** Routing-rules store accessor — used to add tenant-override rows. */
  readonly routingRulesStore: InMemoryRoutingRulesStore;

  /** Registry — exposed so tests + admin routes can introspect. */
  readonly handlerRegistry: AcceptHandlerRegistry;

  /** Persistence accessors — for ops debug surfaces. */
  readonly stores: {
    readonly captures: ConversationCaptureStore;
    readonly proposals: ModuleUpdateProposalStore;
    readonly events: TabEventLogStore;
    readonly auditSink: AuditChainSink;
  };
}

// ─── Deps ────────────────────────────────────────────────────────────────

export interface DispatchRouterWiringDeps {
  /** Estate handler ports. Required since ESTATE is the only live set. */
  readonly estate: EstateHandlerDeps;
  /**
   * Live Drizzle DB handle. When present (prod), the four persistence
   * ports default to the Drizzle-backed stores so captures + proposals
   * survive a process restart and the HITL proposals route reads the same
   * rows the dispatcher wrote. When null/undefined (dev / CI) the wiring
   * falls back to the in-memory stores. Tagged `unknown` to avoid the
   * database-package namespace-vs-type ambiguity at this boundary — same
   * convention as `db-client.ts` / `persistent-stores-wiring.ts`.
   */
  readonly db?: unknown;
  /** Optional override registry (e.g. for tests). */
  readonly handlerRegistry?: AcceptHandlerRegistry;
  /** Optional override routing-rules loader (Drizzle-backed in prod). */
  readonly routingRules?: RoutingRulesLoader;
  /**
   * Optional explicit override of individual stores. Takes precedence over
   * both the Drizzle-from-`db` path and the in-memory defaults — tests
   * inject fakes here. Defaults are resolved per-port below.
   */
  readonly stores?: {
    readonly captures?: ConversationCaptureStore;
    readonly proposals?: ModuleUpdateProposalStore;
    readonly events?: TabEventLogStore;
    readonly auditSink?: AuditChainSink;
  };
  readonly logger?: {
    readonly info?: (meta: object, msg: string) => void;
    readonly warn?: (meta: object, msg: string) => void;
    readonly error?: (meta: object, msg: string) => void;
  };
}

// ─── Composition ──────────────────────────────────────────────────────────

/**
 * Build a fully wired dispatch-router. Used by the api-gateway composition
 * root. Returns a hook that `/think` + `/stream` call after `kernel.think()`.
 */
export function createDispatchRouterWiring(
  deps: DispatchRouterWiringDeps,
): DispatchRouterWiring {
  // 1. Persistence stores — resolution order per port:
  //      explicit override (deps.stores) → Drizzle (when deps.db) → memory.
  // The Drizzle path is the production default: it persists captures +
  // proposals to Postgres so they survive a restart and the HITL
  // proposals route reads the same rows. Returns null when db is absent.
  const drizzleStores = createDrizzleDispatchStores(deps.db);
  const captureStore =
    deps.stores?.captures ??
    drizzleStores?.captures ??
    createInMemoryCaptureStore();
  const proposalStore =
    deps.stores?.proposals ??
    drizzleStores?.proposals ??
    createInMemoryProposalStore();
  const eventLog =
    deps.stores?.events ??
    drizzleStores?.events ??
    createInMemoryEventLogStore();
  const auditSink =
    deps.stores?.auditSink ??
    drizzleStores?.auditSink ??
    createInMemoryAuditChainSink();

  if (deps.logger?.info) {
    deps.logger.info(
      { mode: drizzleStores ? 'drizzle' : 'memory' },
      'dispatch_router_wiring.store_mode',
    );
  }

  // 2. Resolver + intent classifier.
  const { store: resolverStore, resolver } = createInMemoryCanonicalResolver();
  const classifier = createIntentClassifier();

  // 3. Routing-rules loader — in-memory default.
  const { loader: routingRulesLoader, store: routingRulesStore } =
    createInMemoryRoutingRulesLoader();
  const routingRules = deps.routingRules ?? routingRulesLoader;

  // 4. Handler registry — real one with ESTATE adapters by default.
  const handlerRegistry =
    deps.handlerRegistry ??
    createModuleHandlerRegistry({ estate: deps.estate });

  // 5. Boot diagnostics — log which actions are registered.
  if (deps.logger?.info) {
    const registered = (handlerRegistry as { listRegistered?: () => unknown }).listRegistered;
    if (typeof registered === 'function') {
      deps.logger.info(
        { registered: registered() },
        'dispatch_router_wiring.registered_handlers',
      );
    }
  }

  // 6. The hook.
  const postThinkCaptureHook = async (
    input: CaptureInput,
  ): Promise<{
    readonly capture: CaptureResult;
    readonly proposals: ReadonlyArray<ModuleUpdateProposal>;
  }> => {
    try {
      const captureResult = await capture(input, {
        resolver,
        classifier,
        captureStore,
        eventLog,
        auditSink,
      });

      if (!captureResult.shouldDispatch) {
        return { capture: captureResult, proposals: [] };
      }

      const dispatchResult = await runDispatchPipeline(
        {
          tenant_id: input.tenant_id,
          capture: captureResult.capture,
          persona: input.persona,
        },
        {
          routingRules,
          handlerRegistry,
          proposalStore,
          eventLog,
          auditSink,
        },
      );

      deps.logger?.info?.(
        {
          tenant_id: input.tenant_id,
          capture_id: captureResult.capture.id,
          proposal_count: dispatchResult.proposals.length,
          matrix_size: dispatchResult.matrixSize,
          tenant_overrides: dispatchResult.tenantOverrideCount,
        },
        'dispatch_router.turn_complete',
      );

      return { capture: captureResult, proposals: dispatchResult.proposals };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      deps.logger?.error?.(
        { tenant_id: input.tenant_id, error: message },
        'dispatch_router.turn_failed',
      );
      throw err;
    }
  };

  return {
    postThinkCaptureHook,
    resolverStore,
    routingRulesStore,
    handlerRegistry,
    stores: {
      captures: captureStore,
      proposals: proposalStore,
      events: eventLog,
      auditSink,
    },
  };
}

/**
 * Convenience: build a stub estate-handler-deps surface for tests +
 * dev composition where the real ports (LedgerService.post, etc.) are
 * not yet wired. Every port returns a stable fake id so the dispatcher's
 * accept_proposal path is exercisable end-to-end.
 */
export function createStubEstateHandlerDeps(): EstateHandlerDeps {
  // Ports default to TODO console.warn implementations so the integration
  // test verifies the call shape rather than the DB state. This is the
  // explicit "stub the write" path the task description allows.
  const auditChain = {
    async append() {
      // eslint-disable-next-line no-restricted-syntax -- reason: stub/test audit ID, not a secret or security token
      return { id: `stub_audit_${Math.random().toString(36).slice(2, 8)}` };
    },
  };
  const notifications = {
    async publish() {
      /* no-op in dev */
    },
  };
  return {
    moduleId: 'ESTATE',
    createLeaseApplication: {
      coreEntity: {
        async findById() {
          return null;
        },
        async createPerson() {
          // eslint-disable-next-line no-restricted-syntax -- reason: stub/test person ID, not a secret or security token
          return { id: `stub_person_${Math.random().toString(36).slice(2, 8)}` };
        },
      },
      ledger: {
        async post() {
          // eslint-disable-next-line no-restricted-syntax -- reason: stub/test ledger ID, not a secret or security token
          return { id: `stub_ledger_${Math.random().toString(36).slice(2, 8)}` };
        },
      },
      applications: {
        async draftApplication() {
          // eslint-disable-next-line no-restricted-syntax -- reason: stub/test application ID, not a secret or security token
          return { id: `stub_app_${Math.random().toString(36).slice(2, 8)}` };
        },
      },
      auditChain,
      notifications,
    },
    postReceiptDraft: {
      ledger: {
        async draft() {
          // eslint-disable-next-line no-restricted-syntax -- reason: stub/test ledger draft ID, not a secret or security token
          return { id: `stub_ledger_draft_${Math.random().toString(36).slice(2, 8)}` };
        },
      },
      receipts: {
        async draft() {
          // eslint-disable-next-line no-restricted-syntax -- reason: stub/test receipt ID, not a secret or security token
          return { id: `stub_receipt_${Math.random().toString(36).slice(2, 8)}` };
        },
      },
      auditChain,
    },
    openMaintenanceCase: {
      tickets: {
        async open() {
          // Returns null so the handler stubs via console.warn — matches
          // "module table missing" path documented in the brief.
          return null;
        },
      },
      auditChain,
      notifications,
    },
    scheduleRenewalNegotiation: {
      workAssignments: {
        async assign() {
          // Piece M port not yet wired in dev → stub.
          return null;
        },
      },
      auditChain,
      notifications,
    },
    bulkMarkForRenewalPrep: {
      leases: {
        async bulkMarkForRenewalPrep() {
          return null;
        },
      },
      auditChain,
    },
  };
}

// Re-export the handler set builder so dependants can grab it without
// importing both packages.
export { buildEstateHandlerSet, createModuleHandlerRegistry };
