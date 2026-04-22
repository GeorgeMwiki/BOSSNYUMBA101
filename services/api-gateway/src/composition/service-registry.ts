/**
 * Composition root — wires Postgres repos + event bus + domain services
 * into a single typed `ServiceRegistry` that downstream routers pluck
 * out of the Hono context.
 *
 * Rules of engagement:
 *
 *  - Every service that has a Postgres repo AND is pure-DB (no external
 *    API) is constructed here so its endpoints return real data, not
 *    503s.
 *
 *  - Services whose Postgres repos have not yet landed are returned as
 *    `null` — the routers degrade to 503 with a clear reason, which is
 *    the pilot-acceptable behaviour.
 *
 *  - Services requiring external creds (GePG, Anthropic, SendGrid...)
 *    are constructed lazily per request in their routers; the registry
 *    doesn't short-circuit them.
 *
 *  - If `DATABASE_URL` is unset the registry returns an empty skeleton;
 *    routers MUST tolerate that — they should already since the
 *    original stubs also expected potential absence.
 *
 * Subpath imports are used for each domain module (e.g.
 * `@bossnyumba/domain-services/marketplace`) because the top-level
 * barrel re-exports the marketplace/negotiation/waitlist domains under
 * namespaces (`Marketplace.*`, `Negotiation.*`, etc.) which is awkward
 * for direct value access. Subpaths give us clean class imports.
 */

import { createDatabaseClient } from '@bossnyumba/database';
/**
 * The `DatabaseClient` type alias from `@bossnyumba/database` resolves
 * as a namespace when pulled through the package barrel (TS2709) due
 * to `export *` chains widening the symbol space after the Wave 7
 * Drizzle 0.36 upgrade. We derive the type directly from the factory
 * function instead so composition-root callers never have to reach
 * for the alias.
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;
import { sql } from 'drizzle-orm';
import {
  ListingService,
  EnquiryService,
  TenderService,
  PostgresMarketplaceListingRepository,
  PostgresTenderRepository,
  PostgresBidRepository,
} from '@bossnyumba/domain-services/marketplace';
import {
  NegotiationService,
  PostgresNegotiationPolicyRepository,
  PostgresNegotiationRepository,
  PostgresNegotiationTurnRepository,
} from '@bossnyumba/domain-services/negotiation';
import {
  WaitlistService,
  WaitlistVacancyHandler,
  PostgresWaitlistRepository,
  PostgresWaitlistOutreachRepository,
} from '@bossnyumba/domain-services/waitlist';
import {
  OccupancyTimelineService,
  PostgresOccupancyTimelineRepository,
} from '@bossnyumba/domain-services/occupancy';
import {
  StationMasterRouter,
  PostgresStationMasterCoverageRepository,
} from '@bossnyumba/domain-services/routing';
import {
  RenewalService,
  PostgresRenewalRepository,
  MoveOutChecklistService,
} from '@bossnyumba/domain-services/lease';
// Wave 26 Z3 — rich ApprovalWorkflowService + Postgres adapters for
// move-out checklists and approval requests. Pairs with migration 0097.
import { ApprovalWorkflowService } from '@bossnyumba/domain-services/approvals';
import { PostgresMoveOutRepository } from './move-out-repository.js';
import {
  PostgresApprovalRequestRepository,
  PostgresApprovalPolicyRepositoryAdapter,
} from './approval-request-repository.js';
import {
  FinancialProfileService,
  PostgresFinancialStatementRepository,
  PostgresLitigationRepository,
  RiskReportService,
  PostgresRiskReportRepository,
  PostgresRiskReportInputsProvider,
  DeterministicRiskNarrator,
} from '@bossnyumba/domain-services/customer';
import {
  createGamificationService,
  PostgresGamificationRepository,
} from '@bossnyumba/domain-services/gamification';
import {
  MigrationService,
  PostgresMigrationRepository,
} from '@bossnyumba/domain-services/migration';
import {
  CaseService,
  PostgresCaseRepository,
} from '@bossnyumba/domain-services/cases';
import { InMemoryEventBus, type EventBus } from '@bossnyumba/domain-services';

// Wave 8 — Warehouse inventory (S7), Maintenance taxonomy (S7), IoT (S3).
import {
  createWarehouseService,
  DrizzleWarehouseRepository,
  type WarehouseService,
} from '@bossnyumba/domain-services/warehouse';
import {
  createMaintenanceTaxonomyService,
  DrizzleMaintenanceTaxonomyRepository,
  type MaintenanceTaxonomyService,
} from '@bossnyumba/domain-services/maintenance-taxonomy';
import {
  createIotService,
  type IotService,
} from '@bossnyumba/domain-services/iot';
import { createPropertyGradingAdapters } from '@bossnyumba/domain-services/property-grading';
// Wave 29 — forecasting package (TGN + conformal). The concrete
// inference / repository adapters live in external services; the slot
// below stays null until their env vars are set, and the router
// returns 503 FORECAST_SERVICE_UNAVAILABLE in that case.
import type {
  Forecaster,
  FeatureExtractor,
  ForecastRepository,
} from '@bossnyumba/forecasting';
import { PropertyGrading } from '@bossnyumba/ai-copilot';
type PropertyGradingService = import('@bossnyumba/ai-copilot').PropertyGrading.PropertyGradingService;
import {
  createCreditRatingService,
  type CreditRatingService,
} from '@bossnyumba/ai-copilot';
import { PostgresCreditRatingRepository } from './credit-rating-repository.js';
import {
  createArrearsService,
  type ArrearsService,
} from '@bossnyumba/payments-ledger-service/arrears';
import {
  PostgresArrearsRepository,
  PostgresLedgerPort,
  createPostgresArrearsEntryLoader,
  type ArrearsEntryLoader,
} from './arrears-infrastructure.js';

// Wave 9 enterprise polish — Feature flags, GDPR, AI cost ledger.
import {
  createFeatureFlagsService,
  DrizzleFeatureFlagsRepository,
  type FeatureFlagsService,
} from '@bossnyumba/domain-services/feature-flags';
import {
  createGdprService,
  DrizzleGdprRepository,
  type GdprService,
} from '@bossnyumba/domain-services/compliance';
import {
  createCostLedger,
  type CostLedger,
} from '@bossnyumba/ai-copilot';
// Wave-26 Agent Z4 — previously-unwired AI brain utilities now wired through
// the composition root so routers + background workers can consume them.
import {
  buildMultiLLMRouterFromEnv,
  withBudgetGuard,
  createAnthropicClient,
  ModelTier,
  type MultiLLMRouter,
  type BudgetGuardedAnthropicClient,
} from '@bossnyumba/ai-copilot/providers';
import { DrizzleCostLedgerRepository } from './cost-ledger-repository.js';

// Wave 12 — AI copilot subsystems wired into composition root.
import {
  AgentCertificationService,
  PostgresCertStore,
  type SqlRunner as CertSqlRunner,
} from '@bossnyumba/ai-copilot/agent-certification';
import {
  createVoiceRouter,
  ElevenLabsProvider,
  OpenAIVoiceProvider,
  type VoiceRouter,
} from '@bossnyumba/ai-copilot/voice';
import type { BossnyumbaMcpServer } from '@bossnyumba/mcp-server';
import { buildMcpServer } from './mcp-wiring.js';
import {
  createClassroomService,
  type ClassroomService,
} from './classroom-wiring.js';
import {
  createTrainingAdminEndpoints,
  createTrainingGenerator,
  createTrainingAssignmentService,
  createTrainingDeliveryService,
  createInMemoryTrainingRepository,
  type TrainingAdminEndpoints,
  type MasteryPort,
} from '@bossnyumba/ai-copilot/training';
import { OrgAwareness } from '@bossnyumba/ai-copilot';
// Wave 18 final annihilation — autonomy policy service wired into the
// composition root so `GET/PUT /api/v1/autonomy/policy` stops returning
// 503 NOT_IMPLEMENTED.
import {
  AutonomyPolicyService,
  InMemoryAutonomyPolicyRepository,
  buildDefaultPolicy,
} from '@bossnyumba/ai-copilot/autonomy';
import { PostgresAutonomyPolicyRepository } from './autonomy-policy-repository.js';
// Wave 27 Agent E — Tenant Branding (per-tenant AI persona identity).
import {
  TenantBrandingService,
  InMemoryTenantBrandingRepository,
} from '@bossnyumba/ai-copilot';
// Wave 28 — Head Briefing composer + source-port types. Assembles the
// cohesive morning screen from overnight autonomy, pending approvals,
// escalations, KPI deltas, recommendations, and anomalies. Ports are
// wired to in-memory stubs in degraded mode so the /head/briefing
// endpoint always returns a shaped document.
import { HeadBriefing } from '@bossnyumba/ai-copilot';
import {
  ExceptionInbox,
  InMemoryExceptionRepository,
} from '@bossnyumba/ai-copilot/autonomy';
// Wave 28 — Junior-AI factory (team-lead self-service provisioning).
// Repo is in-memory in both degraded and live modes until the Postgres
// adapter lands; provisioning state is non-critical and recoverable.
import {
  JuniorAIFactoryService,
  InMemoryJuniorAIRepository,
} from '@bossnyumba/ai-copilot/junior-ai-factory';
// Central Intelligence — embodied first-person agent (per-tenant +
// platform scopes). The concrete LLM adapter lives in a separate
// service; the agent slot stays null until `CI_LLM_URL` is set so the
// router returns 503 INTELLIGENCE_SERVICE_UNAVAILABLE. Memory is always
// wired to the in-memory default so threads work in-session; a
// pgvector-backed adapter will replace it for production.
// TODO(wave-30): swap in pgvector-backed ConversationMemory for prod.
import {
  createInMemoryConversationMemory,
  type CentralIntelligenceAgent,
  type ConversationMemory,
} from '@bossnyumba/central-intelligence';
// Canonical Property Graph (CPG) — Neo4j query service. Constructed
// lazily so the gateway still boots when NEO4J_URI is unset; the graph
// router returns 503 GRAPH_SERVICE_UNAVAILABLE when this slot is null.
import {
  createNeo4jClient,
  createGraphQueryService,
  type GraphQueryService,
} from '@bossnyumba/graph-sync';

// Wave 26 — Agent Z2: four Postgres repos that Wave-25 Agent T flagged as
// "tests passing but no router / composition wiring". Importing through
// the namespace barrels added to cases/inspections so the classes reach
// the composition root without churning every callsite.
import {
  Sublease as SubleaseNs,
  DamageDeduction as DamageDeductionNs,
} from '@bossnyumba/domain-services/cases';
import {
  ConditionalSurvey as ConditionalSurveyNs,
  Far as FarNs,
} from '@bossnyumba/domain-services/inspections';
type PostgresSubleaseRepository = InstanceType<
  typeof SubleaseNs.PostgresSubleaseRepository
>;
type PostgresTenantGroupRepository = InstanceType<
  typeof SubleaseNs.PostgresTenantGroupRepository
>;
type SubleaseService = InstanceType<typeof SubleaseNs.SubleaseService>;
type PostgresDamageDeductionRepository = InstanceType<
  typeof DamageDeductionNs.PostgresDamageDeductionRepository
>;
type DamageDeductionService = InstanceType<
  typeof DamageDeductionNs.DamageDeductionService
>;
type PostgresConditionalSurveyRepository = InstanceType<
  typeof ConditionalSurveyNs.PostgresConditionalSurveyRepository
>;
type ConditionalSurveyService = InstanceType<
  typeof ConditionalSurveyNs.ConditionalSurveyService
>;
type PostgresFarRepository = InstanceType<typeof FarNs.PostgresFarRepository>;
type FarService = InstanceType<typeof FarNs.FarService>;

type OrgAwarenessRegistry = {
  readonly miner: InstanceType<typeof OrgAwareness.ProcessMiner>;
  readonly bottleneckDetector: InstanceType<
    typeof OrgAwareness.BottleneckDetector
  >;
  readonly improvementTracker: InstanceType<
    typeof OrgAwareness.ImprovementTracker
  >;
  readonly queryService: InstanceType<typeof OrgAwareness.OrgQueryService>;
  readonly observationStore: InstanceType<
    typeof OrgAwareness.InMemoryProcessObservationStore
  >;
  readonly bottleneckStore: InstanceType<
    typeof OrgAwareness.InMemoryBottleneckStore
  >;
  readonly snapshotStore: InstanceType<
    typeof OrgAwareness.InMemoryImprovementSnapshotStore
  >;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServiceRegistry {
  /** Pure-DB services — instantiated iff DATABASE_URL is set. */
  readonly marketplace: {
    readonly listing: ListingService | null;
    readonly enquiry: EnquiryService | null;
    readonly tender: TenderService | null;
  };
  readonly negotiation: NegotiationService | null;
  readonly waitlist: {
    readonly service: WaitlistService | null;
    readonly vacancyHandler: WaitlistVacancyHandler | null;
  };
  readonly occupancyTimeline: OccupancyTimelineService | null;
  readonly stationMasterRouter: StationMasterRouter | null;
  readonly stationMasterCoverageRepo: PostgresStationMasterCoverageRepository | null;
  readonly renewal: RenewalService | null;
  readonly financialProfile: FinancialProfileService | null;
  readonly riskReport: RiskReportService | null;
  readonly gamification: ReturnType<typeof createGamificationService> | null;
  readonly migration: MigrationService | null;

  /** Wave 8 additions — all three are pure-DB. */
  readonly warehouse: WarehouseService | null;
  readonly maintenanceTaxonomy: MaintenanceTaxonomyService | null;
  readonly iot: IotService | null;

  /** Wave 9 enterprise polish — feature flags, GDPR, AI cost ledger. */
  readonly featureFlags: FeatureFlagsService | null;
  readonly gdpr: GdprService | null;
  readonly aiCostLedger: CostLedger | null;

  /**
   * Wave 26 Agent Z4 — multi-LLM router built from env keys. Null when no
   * Anthropic key is configured (the gateway still boots, the brain routes
   * return 503 `BRAIN_NOT_CONFIGURED` as before). When present, the router
   * already enforces per-tenant budget via `CostLedger.assertWithinBudget`
   * up-front and records usage after every provider call.
   */
  readonly llmRouter: MultiLLMRouter | null;

  /**
   * Wave 26 Agent Z4 — Anthropic client wrapped with `withBudgetGuard` so
   * every `messages.create` call checks the per-tenant monthly cap and
   * records usage into the `CostLedger`. Exposed as a pure factory because
   * the tenant context is only known at request time — callers invoke
   * `buildBudgetGuardedAnthropicClient(tenantId, operation?)` to get a
   * client with the right context closed over.
   */
  readonly buildBudgetGuardedAnthropicClient:
    | ((tenantId: string, operation?: string) => BudgetGuardedAnthropicClient)
    | null;

  /** Arrears ledger (NEW 4). Service + loader for the projection endpoint. */
  readonly arrears: {
    readonly service: ArrearsService | null;
    readonly repo: PostgresArrearsRepository | null;
    readonly ledgerPort: PostgresLedgerPort | null;
    readonly entryLoader: ArrearsEntryLoader | null;
  };

  /** Cases — dispute / legal / maintenance case lifecycle. Wave 26 wiring
   *  of the previously-dark PostgresCaseRepository + CaseService +
   *  CaseSLAWorker triad. `service` is the domain service (used by
   *  routers + SLA worker); `repo` is the Postgres adapter (exposed for
   *  routers that need raw reads without the service overhead). Both
   *  null in degraded mode. */
  readonly cases: {
    readonly service: CaseService | null;
    readonly repo: PostgresCaseRepository | null;
  };

  /** Wave 12 — AI copilot subsystems wired into the composition root. */
  readonly mcp: BossnyumbaMcpServer | null;
  readonly agentCertification: AgentCertificationService | null;
  readonly classroom: ClassroomService | null;
  readonly training: TrainingAdminEndpoints | null;
  readonly voice: VoiceRouter | null;

  /** Organizational Awareness — process mining, bottleneck detection,
   *  improvement tracking, "talk to your organization" query service.
   *  In-memory-backed for pilot; swap to Postgres adapters when ready. */
  readonly orgAwareness: OrgAwarenessRegistry;

  /** Autonomy policy — per-tenant Autonomous Department Mode config.
   *  Postgres-backed in live mode, in-memory when DATABASE_URL is unset
   *  (so the endpoint stays 200 OK in local dev). */
  readonly autonomy: {
    readonly policyService: AutonomyPolicyService;
  };

  /** Tenant branding (Wave 27 Agent E) — per-tenant AI persona identity.
   *  Replaces hardcoded 'Mr. Mwikila' literals with configurable overrides
   *  (display name, honorific, greeting, pronoun). In-memory repository in
   *  both live + degraded modes until a Postgres migration lands. */
  readonly branding: {
    readonly service: TenantBrandingService;
  };

  /** Head briefing (Wave 28) — cohesive morning screen composer. Pulls
   *  from overnight-autonomy / pending-approvals / escalations / KPI /
   *  recommendations / anomalies sources and returns a single
   *  BriefingDocument. In-memory stubs in both live + degraded modes
   *  until real data-warehouse + ambient-brain adapters land. */
  readonly headBriefing: {
    readonly composer: HeadBriefing.BriefingComposer;
  };

  /** Junior-AI factory (Wave 28) — self-service provisioning for team
   *  leads. Each junior inherits a strict subset of the tenant
   *  AutonomyPolicy and is lifecycle-bounded. In-memory repo in both
   *  modes (provisioning state is non-critical; Postgres adapter is
   *  a follow-up). */
  readonly juniorAI: {
    readonly factoryService: JuniorAIFactoryService;
  };

  /** Canonical Property Graph (CPG) — Neo4j-backed relationship graph.
   *  Null in both degraded + live modes when NEO4J_URI is unset so the
   *  gateway boots without a Neo4j upstream; the `graph.router` degrades
   *  to 503 GRAPH_SERVICE_UNAVAILABLE in that case. When env vars are
   *  present we construct a pooled `Neo4jClient` and wrap it in a
   *  `GraphQueryService` that every route (named queries, 1-ring
   *  neighbourhood, k-hop expansion, graph health) shares. */
  readonly graph: {
    readonly queryService: GraphQueryService | null;
  };

  /** Property grading — A–F report card scoring + portfolio rollup.
   *  Postgres-backed in live mode, null when DATABASE_URL is unset. */
  readonly propertyGrading: PropertyGradingService | null;

  /** Central Intelligence — embodied first-person agent surface.
   *  The concrete LLM adapter lives in a separate service; `agent` only
   *  becomes non-null when `CI_LLM_URL` is present AND the adapter has
   *  been wired (follow-up PR). `memory` is always wired to the
   *  in-memory default so threads survive in-session — a pgvector-
   *  backed adapter will replace it for production persistence.
   *  TODO(wave-30): swap `memory` to pgvector-backed adapter.
   */
  readonly centralIntelligence: {
    readonly agent: CentralIntelligenceAgent | null;
    readonly memory: ConversationMemory | null;
  };

  /** Wave 29 — Forecasting (TGN + conformal prediction intervals).
   *  Every member is `null` until BOTH `TGN_INFERENCE_URL` and
   *  `FORECASTING_REPO_URL` are set. When null, the forecast router
   *  returns 503 `FORECAST_SERVICE_UNAVAILABLE`. No mock data is ever
   *  returned. The inference + repository adapters are PORTS — the
   *  concrete runtime (Python TGN sidecar + Postgres or Memgraph repo)
   *  is plugged in by the deploy, not this file. */
  readonly forecasting: {
    readonly forecaster: Forecaster | null;
    readonly featureExtractor: FeatureExtractor | null;
    readonly repository: ForecastRepository | null;
  };

  /** Tenant credit rating — FICO-scale 300-850 rating with CRB bands
   *  and portable certificate. Postgres-backed in live mode. */
  readonly creditRating: CreditRatingService | null;

  /** Move-out checklist (Wave 26 Z3). Tracks the 4-step end-of-tenancy
   *  workflow (final inspection, utility readings, deposit reconciliation,
   *  residency-proof letter). Postgres-backed when DATABASE_URL is set. */
  readonly moveOut: {
    readonly service: MoveOutChecklistService | null;
  };

  /** Approval workflow (Wave 26 Z3). Handles pending-approval requests for
   *  maintenance_cost, refund, discount, lease_exception, payment_flexibility.
   *  Integrates with the autonomy-policy thresholds (Wave 18). */
  readonly approvals: {
    readonly service: ApprovalWorkflowService | null;
  };

  /** Wave 26 — Sublease + tenant-group persistence. Postgres-backed when
   *  DATABASE_URL is set; null in degraded mode. The router degrades to
   *  503 cleanly when the slot is null. */
  readonly sublease: {
    readonly service: SubleaseService | null;
    readonly repo: PostgresSubleaseRepository | null;
    readonly tenantGroupRepo: PostgresTenantGroupRepository | null;
  };

  /** Wave 26 — Damage-deduction negotiation claims (move-out). */
  readonly damageDeductions: {
    readonly service: DamageDeductionService | null;
    readonly repo: PostgresDamageDeductionRepository | null;
  };

  /** Wave 26 — Conditional surveys (findings + action plans). */
  readonly conditionalSurveys: {
    readonly service: ConditionalSurveyService | null;
    readonly repo: PostgresConditionalSurveyRepository | null;
  };

  /** Wave 26 — Fitness-for-Assessment Review (FAR): asset components,
   *  monitoring assignments, and condition-check events. */
  readonly far: {
    readonly service: FarService | null;
    readonly repo: PostgresFarRepository | null;
  };

  /** Single shared in-process event bus. */
  readonly eventBus: EventBus;

  /** Underlying Drizzle client (null in degraded mode). */
  readonly db: DatabaseClient | null;

  /** True when DATABASE_URL was set and services were constructed. */
  readonly isLive: boolean;
}

export interface BuildServicesInput {
  readonly db: DatabaseClient | null;
  /** Optional pre-seeded event bus (tests). */
  readonly eventBus?: EventBus;
}

// ---------------------------------------------------------------------------
// Degraded skeleton — every service null
// ---------------------------------------------------------------------------

function buildOrgAwareness(eventBus: EventBus): OrgAwarenessRegistry {
  const observationStore = new OrgAwareness.InMemoryProcessObservationStore();
  const bottleneckStore = new OrgAwareness.InMemoryBottleneckStore();
  const snapshotStore = new OrgAwareness.InMemoryImprovementSnapshotStore();
  const miner = OrgAwareness.createProcessMiner({
    store: observationStore,
  });
  const bottleneckDetector = OrgAwareness.createBottleneckDetector({
    observationStore,
    bottleneckStore,
    miner,
  });
  const improvementTracker = OrgAwareness.createImprovementTracker({
    store: snapshotStore,
  });
  const queryService = OrgAwareness.createOrgQueryService({
    miner,
    bottleneckStore,
    improvementTracker,
  });
  // Subscribe to platform events so every emitted lifecycle event
  // lands in the process-miner's observation stream. Bus-shape shim
  // because `EventBus.publish(env)` wraps events — we expose a
  // `subscribe(type, handler)` facade over the existing bus.
  const busShim: OrgAwareness.PlatformBusLike = {
    subscribe(eventType, handler) {
      const offs: Array<() => void> = [];
      const sub = (eventBus as unknown as {
        subscribe?: (t: string, h: (e: unknown) => void) => () => void;
      }).subscribe;
      if (typeof sub === 'function') {
        offs.push(
          sub.call(eventBus, eventType, (envelope: unknown) => {
            const evt = (envelope as { event?: unknown })?.event ?? envelope;
            handler(evt as OrgAwareness.PlatformEventLike);
          }),
        );
      }
      return () => {
        for (const off of offs) off();
      };
    },
  };
  OrgAwareness.subscribeOrgEvents({ bus: busShim, miner });
  return {
    miner,
    bottleneckDetector,
    improvementTracker,
    queryService,
    observationStore,
    bottleneckStore,
    snapshotStore,
  };
}

/**
 * Build a head-briefing composer backed by in-memory stub sources.
 *
 * Wave 28 ships the composer + its source-port contract only. The real
 * adapters (AutonomousActionAudit, ApprovalGrantService.listActive,
 * ExceptionInbox.listOpen, KPI warehouse, StrategicAdvisor, anomaly
 * pattern-miner) can be swapped in iteratively by overriding individual
 * dependencies on the returned composer deps shape. Until then every
 * request returns a shaped-but-empty BriefingDocument, which is the
 * pilot-acceptable behaviour for a brand-new endpoint.
 */
function buildHeadBriefingComposer(
  exceptionInbox: ExceptionInbox | null,
): HeadBriefing.BriefingComposer {
  const overnightSource: HeadBriefing.OvernightSource = {
    async summarize() {
      return {
        totalAutonomousActions: 0,
        byDomain: {},
        notableActions: [],
      };
    },
  };
  const pendingApprovalsSource: HeadBriefing.PendingApprovalsSource = {
    async list() {
      return { count: 0, items: [] };
    },
  };
  const escalationsSource: HeadBriefing.EscalationsSource = {
    async list(tenantId) {
      if (!exceptionInbox) {
        return {
          count: 0,
          byPriority: { P1: 0, P2: 0, P3: 0 },
          items: [],
        };
      }
      const open = await exceptionInbox.listOpen(tenantId, { limit: 10 });
      const byPriority = { P1: 0, P2: 0, P3: 0 };
      for (const e of open) {
        byPriority[e.priority] = (byPriority[e.priority] ?? 0) + 1;
      }
      return {
        count: open.length,
        byPriority,
        items: open.map((e) => ({
          exceptionId: e.id,
          priority: e.priority,
          summary: e.title,
          domain: e.domain,
        })),
      };
    },
  };
  const kpiSource: HeadBriefing.KpiSource = {
    async fetch() {
      return {
        occupancyPct: { value: 0, delta7d: 0 },
        collectionsRate: { value: 0, delta7d: 0 },
        arrearsDays: { value: 0, delta7d: 0 },
        maintenanceSLA: { value: 0, delta7d: 0 },
        tenantSatisfaction: { value: 0, delta30d: 0 },
        noi: { value: 0, delta30d: 0 },
      };
    },
  };
  const recommendationsSource: HeadBriefing.RecommendationsSource = {
    async list() {
      return [];
    },
  };
  const anomaliesSource: HeadBriefing.AnomaliesSource = {
    async list() {
      return [];
    },
  };
  return HeadBriefing.createBriefingComposer({
    overnightSource,
    pendingApprovalsSource,
    escalationsSource,
    kpiSource,
    recommendationsSource,
    anomaliesSource,
  });
}

/**
 * Build the Canonical Property Graph (CPG) query service.
 *
 * Returns null when NEO4J_URI is unset so the gateway boots without a
 * Neo4j upstream; the graph router surfaces 503 GRAPH_SERVICE_UNAVAILABLE
 * in that case. When present, we construct a pooled `Neo4jClient` via
 * `createNeo4jClient` (which reads NEO4J_USER / NEO4J_PASSWORD /
 * NEO4J_DATABASE internally) and wrap it in a `GraphQueryService`. The
 * client is eagerly instantiated but `verifyConnectivity` is NOT called
 * — boot stays fast; the health endpoint probes liveness on demand.
 */
function buildGraphQueryService(): GraphQueryService | null {
  if (!process.env.NEO4J_URI?.trim()) return null;
  try {
    const client = createNeo4jClient();
    return createGraphQueryService(client);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      'service-registry: graph query service init failed — returning null',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function degradedRegistry(eventBus: EventBus): ServiceRegistry {
  return {
    marketplace: { listing: null, enquiry: null, tender: null },
    negotiation: null,
    waitlist: { service: null, vacancyHandler: null },
    occupancyTimeline: null,
    stationMasterRouter: null,
    stationMasterCoverageRepo: null,
    renewal: null,
    financialProfile: null,
    riskReport: null,
    gamification: null,
    migration: null,
    warehouse: null,
    maintenanceTaxonomy: null,
    iot: null,
    featureFlags: null,
    gdpr: null,
    aiCostLedger: null,
    llmRouter: null,
    buildBudgetGuardedAnthropicClient: null,
    arrears: {
      service: null,
      repo: null,
      ledgerPort: null,
      entryLoader: null,
    },
    cases: {
      service: null,
      repo: null,
    },
    mcp: null,
    agentCertification: null,
    classroom: null,
    training: null,
    voice: null,
    orgAwareness: buildOrgAwareness(eventBus),
    autonomy: {
      // Degraded mode: in-memory repository so the endpoint still
      // returns a defaults-shaped policy. Never persists across
      // restarts — fine for local-dev / DB-down degraded mode.
      policyService: new AutonomyPolicyService({
        repository: new InMemoryAutonomyPolicyRepository(),
      }),
    },
    branding: {
      // Wave 27 Agent E — tenant branding. In-memory repo is fine in
      // degraded mode; overrides don't persist across restarts.
      service: new TenantBrandingService(new InMemoryTenantBrandingRepository()),
    },
    headBriefing: {
      // Wave 28 — head briefing composer with in-memory source stubs.
      // Degraded mode uses a fresh ExceptionInbox backed by an empty
      // in-memory repo so the escalations section returns zero instead
      // of throwing.
      composer: buildHeadBriefingComposer(
        new ExceptionInbox({ repository: new InMemoryExceptionRepository() }),
      ),
    },
    juniorAI: {
      // Wave 28 — team-lead self-service junior-AI factory. In-memory
      // repo + a degraded autonomy-policy loader that returns a
      // permissive default (level 0, empty domain policies) so the
      // policy-subset check still runs and routes always shape.
      factoryService: new JuniorAIFactoryService({
        repository: new InMemoryJuniorAIRepository(),
        autonomyPolicyLoader: async (tenantId: string) => buildDefaultPolicy(tenantId),
      }),
    },
    graph: { queryService: buildGraphQueryService() },
    // Central Intelligence — no concrete LLM adapter ships here (it
    // lives in a separate service). In degraded mode we still wire the
    // in-memory memory so thread listing works locally.
    // TODO(wave-30): replace with pgvector-backed ConversationMemory.
    centralIntelligence: {
      agent: null,
      memory: createInMemoryConversationMemory(),
    },
    propertyGrading: null,
    creditRating: null,
    // Wave 29 — forecasting stays null in degraded mode; the router
    // returns 503 FORECAST_SERVICE_UNAVAILABLE. No mock data ever.
    forecasting: {
      forecaster: null,
      featureExtractor: null,
      repository: null,
    },
    // Wave 26 — Agent Z2 slots default to null in degraded mode. Each
    // router checks the slot and returns 503 with a clear reason when
    // DATABASE_URL is unset.
    sublease: { service: null, repo: null, tenantGroupRepo: null },
    damageDeductions: { service: null, repo: null },
    conditionalSurveys: { service: null, repo: null },
    far: { service: null, repo: null },
    // Wave 26 Z3 — move-out + approvals wiring.
    moveOut: { service: null },
    approvals: { service: null },
    eventBus,
    db: null,
    isLive: false,
  };
}

// ---------------------------------------------------------------------------
// buildServices — composition root
// ---------------------------------------------------------------------------

export function buildServices(input: BuildServicesInput): ServiceRegistry {
  const registry = buildServicesInner(input);
  if (!registry.isLive) return registry;
  // MCP server is built after the registry because its handlers close
  // over the populated services. Patch the `mcp` slot — the rest of the
  // object remains effectively immutable from callers' perspective.
  (registry as { mcp: BossnyumbaMcpServer | null }).mcp = buildMcpServer(
    registry,
    registry.agentCertification,
  );
  return registry;
}

function buildServicesInner(input: BuildServicesInput): ServiceRegistry {
  const eventBus: EventBus = input.eventBus ?? new InMemoryEventBus();

  if (!input.db) return degradedRegistry(eventBus);

  const db = input.db;

  // Marketplace repos
  const listingRepo = new PostgresMarketplaceListingRepository(db);
  const tenderRepo = new PostgresTenderRepository(db);
  const bidRepo = new PostgresBidRepository(db);

  // Negotiation repos
  const policyRepo = new PostgresNegotiationPolicyRepository(db);
  const negotiationRepo = new PostgresNegotiationRepository(db);
  const turnRepo = new PostgresNegotiationTurnRepository(db);

  // Negotiation service (shared by marketplace enquiry + tenders/bids)
  const negotiationService = new NegotiationService({
    policyRepo,
    negotiationRepo,
    turnRepo,
    eventBus,
  });

  // Pre-insert unit-existence check for listing publish. Without this, a
  // bogus `unitId` lands in Postgres as a raw FK violation and the gateway
  // returns 500. We probe `units` with a tenant-scoped `SELECT 1` and
  // return a clean VALIDATION (400) when the unit is missing. Uses a
  // parameterised `sql` template so the unitId is bound safely even if
  // the caller forges the body.
  const unitExists = async (tenantId: string, unitId: string): Promise<boolean> => {
    try {
      const rows = await (db as any).execute(
        sql`SELECT 1 FROM units WHERE id = ${unitId} AND tenant_id = ${tenantId} LIMIT 1`
      );
      // postgres.js returns an array-like; drizzle `execute` yields `{ rows }`
      // depending on driver. Accept both shapes.
      const list = Array.isArray(rows) ? rows : (rows as any)?.rows ?? [];
      return list.length > 0;
    } catch {
      // If the probe itself fails, fall back to letting the DB layer raise —
      // the FK violation will still be caught downstream.
      return true;
    }
  };

  const listingService = new ListingService({ repo: listingRepo, eventBus, unitExists });
  const enquiryService = new EnquiryService({
    listingRepo,
    negotiationService,
    eventBus,
  });
  const tenderService = new TenderService({
    tenderRepo,
    bidRepo,
    eventBus,
  });

  // Waitlist
  const waitlistRepo = new PostgresWaitlistRepository(db);
  const outreachRepo = new PostgresWaitlistOutreachRepository(db);
  const waitlistService = new WaitlistService({ repo: waitlistRepo, eventBus });
  // Vacancy handler requires an OutreachDispatcher; for pilot we inject a
  // no-op dispatcher so GET endpoints work and the POST trigger-outreach
  // endpoint succeeds without actually sending. Wire to the real NBA
  // queue in a follow-up.
  const noopDispatcher = {
    async dispatch() {
      return null;
    },
  };
  const vacancyHandler = new WaitlistVacancyHandler({
    repo: waitlistRepo,
    outreachRepo,
    eventBus,
    dispatcher: noopDispatcher,
  });

  // Gamification
  const gamificationRepo = new PostgresGamificationRepository(db);
  const gamificationService = createGamificationService({
    repo: gamificationRepo,
  });

  // Migration
  const migrationRepo = new PostgresMigrationRepository({ db });
  const migrationService = new MigrationService({
    repository: migrationRepo,
    eventBus: {
      emit: async (event) => {
        // Adapt the MigrationService's minimal EventBus to the platform
        // bus so downstream subscribers still see the events.
        await eventBus.publish({
          event: event as unknown as never,
          version: 1,
          aggregateId: (event as { runId?: string }).runId ?? 'unknown',
          aggregateType: 'MigrationRun',
        });
      },
    },
  });

  // Occupancy Timeline (NEW 22) — Postgres-backed service over leases/customers.
  const occupancyTimelineRepo = new PostgresOccupancyTimelineRepository(db);
  const occupancyTimelineService = new OccupancyTimelineService(
    occupancyTimelineRepo
  );

  // Station Master Coverage (NEW 18) — router + coverage repo for applications.
  const stationMasterCoverageRepo = new PostgresStationMasterCoverageRepository(
    db
  );
  const stationMasterRouter = new StationMasterRouter({
    repository: stationMasterCoverageRepo,
  });

  // Lease Renewal workflow — Postgres-backed over leases table.
  const renewalRepo = new PostgresRenewalRepository(db);
  const renewalService = new RenewalService(renewalRepo, eventBus);

  // Financial Profile + Risk Reports (SCAFFOLDED-5, NEW-13).
  const financialStatementRepo = new PostgresFinancialStatementRepository(db);
  const litigationRepo = new PostgresLitigationRepository(db);
  const financialProfileService = new FinancialProfileService(
    financialStatementRepo,
    litigationRepo,
    eventBus,
    null // no bank-reference provider wired yet — service returns a structured
         // PROVIDER_ERROR instead of crashing on verify-bank-reference
  );
  const riskReportRepo = new PostgresRiskReportRepository(db);
  const riskReportInputsProvider = new PostgresRiskReportInputsProvider(db);
  const riskReportService = new RiskReportService(
    riskReportRepo,
    riskReportInputsProvider,
    new DeterministicRiskNarrator()
  );

  // Wave 8 — Warehouse (S7): stock + movements.
  const warehouseRepo = new DrizzleWarehouseRepository(db);
  const warehouseService = createWarehouseService({ repo: warehouseRepo });

  // Wave 8 — Maintenance Taxonomy (S7): platform defaults + tenant overrides.
  const taxonomyRepo = new DrizzleMaintenanceTaxonomyRepository(db);
  const maintenanceTaxonomyService = createMaintenanceTaxonomyService({
    repo: taxonomyRepo,
  });

  // Wave 8 — IoT (S3): sensor registry + observation ingest + anomaly store.
  // Service takes the drizzle client directly since all tables live under
  // the same client and queries are straight-through.
  const iotService = createIotService({ db });

  // Arrears Ledger (NEW 4) — Postgres repo + ledger-port + projection
  // loader. The repo persists line proposals + cases; the ledger port
  // appends adjustment rows into `transactions` on approval; the entry
  // loader powers `GET /arrears/cases/:id/projection` by pulling real
  // ledger rows out of Postgres (never mock).
  const arrearsRepo = new PostgresArrearsRepository(db);
  const arrearsLedgerPort = new PostgresLedgerPort(db);
  const arrearsService = createArrearsService({
    repo: arrearsRepo,
    ledger: arrearsLedgerPort,
  });
  const arrearsEntryLoader = createPostgresArrearsEntryLoader(db);

  // Wave 26 — Cases domain service + Postgres repo. The repo implements
  // `Partial<CaseRepository>` with the surface the SLA worker + service
  // need (createCase/findById/update/findOverdue/appendTimelineEvent)
  // backed by the real `cases` table. The service publishes the
  // CaseCreated/Escalated/Resolved event stream through the shared
  // composition-root bus so downstream subscribers (notifications,
  // autonomy audit) see them without any extra wiring.
  //
  // The Postgres adapter advertises `Partial<CaseRepository>` but
  // implements every method actually invoked by the service + worker
  // (verified in postgres-case-repository.test.ts). We cast to the
  // full interface at the composition-root boundary only.
  const caseRepo = new PostgresCaseRepository(db as unknown as never);
  const caseService = new CaseService(
    caseRepo as unknown as Parameters<typeof CaseService['prototype']['attachRepository']>[0],
    eventBus,
  );

  // Wave 9 — Feature flags (per-tenant gating of platform capabilities).
  const featureFlagsRepo = new DrizzleFeatureFlagsRepository(db);
  const featureFlagsService = createFeatureFlagsService({
    repo: featureFlagsRepo,
  });

  // Wave 9 — GDPR right-to-be-forgotten.
  const gdprRepo = new DrizzleGdprRepository(db);
  const gdprService = createGdprService({
    repo: gdprRepo,
    eventBus,
  });

  // Wave 9 — AI cost ledger + per-tenant monthly budget.
  const costLedgerRepo = new DrizzleCostLedgerRepository(db);
  const aiCostLedger = createCostLedger({ repo: costLedgerRepo });

  // Wave 26 Agent Z4 — multi-LLM router (Anthropic primary, OpenAI/DeepSeek
  // fallback when their keys are set). The router itself pulls from the
  // cost ledger for budget enforcement and usage recording. We build it
  // lazily so the gateway still boots when no Anthropic key is present
  // (the brain routes already return 503 BRAIN_NOT_CONFIGURED in that case).
  const llmRouter: MultiLLMRouter | null = process.env.ANTHROPIC_API_KEY
    ? (() => {
        try {
          return buildMultiLLMRouterFromEnv(aiCostLedger);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            'service-registry: buildMultiLLMRouterFromEnv failed — falling back to null',
            err instanceof Error ? err.message : err,
          );
          return null;
        }
      })()
    : null;

  // Wave 26 Agent Z4 — pre-built Anthropic client wrapped with withBudgetGuard.
  // Returned as a factory because the tenant context (used by the guard to
  // call `ledger.assertWithinBudget(tenantId)` before every HTTP call) is
  // only known at request time. Callers pass in the tenantId + optional
  // operation tag; the returned client is structurally identical to an
  // unguarded `AnthropicClient` so downstream services can't tell the
  // difference.
  const buildBudgetGuardedAnthropicClient = process.env.ANTHROPIC_API_KEY
    ? (tenantId: string, operation?: string): BudgetGuardedAnthropicClient => {
        const inner = createAnthropicClient({
          apiKey: process.env.ANTHROPIC_API_KEY as string,
          defaultModel: ModelTier.SONNET,
        });
        return withBudgetGuard(inner, {
          ledger: aiCostLedger,
          context: () => ({ tenantId, operation }),
          provider: 'anthropic',
        });
      }
    : null;

  // Wave 12 — Agent Certification (Postgres-backed). SigningSecret comes from
  // env; falls back to JWT_SECRET for operator convenience. In production,
  // refuse to boot if neither is set (no silent dev-default signing).
  const certSigningSecretFromEnv =
    process.env.AGENT_CERT_SIGNING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    '';
  if (process.env.NODE_ENV === 'production' && certSigningSecretFromEnv.length < 32) {
    throw new Error(
      'AGENT_CERT_SIGNING_SECRET (or JWT_SECRET) must be set and >= 32 chars in production',
    );
  }
  const certSigningSecret =
    certSigningSecretFromEnv || 'dev-only-agent-cert-signing-secret-32chars';
  const certSqlRunner: CertSqlRunner = {
    async query<Row = Record<string, unknown>>(
      queryText: string,
      params?: readonly unknown[],
    ): Promise<{ rows: readonly Row[] }> {
      const rendered = sql.raw(
        interpolatePositionalSql(queryText, params ?? []),
      );
      const res = await (db as any).execute(rendered);
      const list = Array.isArray(res)
        ? (res as Row[])
        : ((res as { rows?: Row[] }).rows ?? []);
      return { rows: list };
    },
  };
  const certStore = new PostgresCertStore(certSqlRunner);
  const agentCertification = new AgentCertificationService(certStore, {
    signingSecret: certSigningSecret,
    issuerId: 'bossnyumba-gateway',
  });

  // Wave 12 — Classroom (BKT-backed with Postgres persistence).
  const classroom = createClassroomService(db);

  // Adaptive Training — sits on top of classroom BKT and uses the in-memory
  // repo for pilot (the Postgres adapter lives in the training module and
  // can be dropped in once the training tables are migrated live).
  const trainingRepo = createInMemoryTrainingRepository();
  const trainingGenerator = createTrainingGenerator({});
  const trainingMastery: MasteryPort = {
    async getMastery(tenantId: string, userId: string) {
      const rows = (await classroom.getMastery(tenantId, userId)) ?? [];
      const map: Record<string, number> = {};
      for (const r of rows as ReadonlyArray<{ conceptId: string; pKnow: number }>) {
        map[r.conceptId] = r.pKnow;
      }
      return map;
    },
  };
  const trainingAssignmentService = createTrainingAssignmentService({
    repo: trainingRepo,
    eventBus: {
      async publish(evt) {
        await eventBus.publish({
          event: evt as unknown as never,
          version: 1,
          aggregateId: (evt.payload as { assignmentId?: string }).assignmentId ?? 'training',
          aggregateType: 'TrainingAssignment',
        });
      },
    },
    featureFlags: featureFlagsService
      ? {
          async isEnabled(tenantId: string, flag: string) {
            try {
              return await (featureFlagsService as unknown as {
                isEnabled(t: string, f: string): Promise<boolean>;
              }).isEnabled(tenantId, flag);
            } catch {
              return true;
            }
          },
        }
      : null,
  });
  const trainingDeliveryService = createTrainingDeliveryService({
    repo: trainingRepo,
    mastery: trainingMastery,
  });
  const training = createTrainingAdminEndpoints({
    generator: trainingGenerator,
    assignmentService: trainingAssignmentService,
    deliveryService: trainingDeliveryService,
    repo: trainingRepo,
  });

  // Wave 26 — Agent Z2: build the four newly-wired repos + services.
  // Every repo takes the shared drizzle client; services wrap the repos
  // and accept the shared event bus so emitted events flow through the
  // existing outbox/observability bridge.
  const subleaseRepo = new SubleaseNs.PostgresSubleaseRepository(
    db as unknown as SubleaseNs.PostgresSubleaseRepositoryClient,
  );
  const tenantGroupRepo = new SubleaseNs.PostgresTenantGroupRepository(
    db as unknown as SubleaseNs.PostgresTenantGroupRepositoryClient,
  );
  const subleaseService = new SubleaseNs.SubleaseService(
    subleaseRepo,
    tenantGroupRepo,
  );

  const damageDeductionRepo =
    new DamageDeductionNs.PostgresDamageDeductionRepository(
      db as unknown as DamageDeductionNs.PostgresDamageDeductionRepositoryClient,
    );
  // No evidence-bundle / AI-mediator gateway at this level — the service
  // falls back to a deterministic midpoint if ai-copilot isn't wired,
  // which matches the behaviour documented in the service itself.
  const damageDeductionService = new DamageDeductionNs.DamageDeductionService(
    damageDeductionRepo,
  );

  const conditionalSurveyRepo =
    new ConditionalSurveyNs.PostgresConditionalSurveyRepository(
      db as unknown as ConditionalSurveyNs.PostgresConditionalSurveyRepositoryClient,
    );
  const conditionalSurveyService =
    new ConditionalSurveyNs.ConditionalSurveyService(
      conditionalSurveyRepo,
      eventBus,
    );

  const farRepo = new FarNs.PostgresFarRepository(
    db as unknown as FarNs.PostgresFarRepositoryClient,
  );
  const farService = new FarNs.FarService(farRepo, eventBus);

  // Wave 12 — Voice router. If neither ELEVENLABS_API_KEY nor OPENAI_API_KEY
  // is set, `voice` stays null and the HTTP router returns a clean 503
  // with a MISSING_KEY reason.
  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  let voice: VoiceRouter | null = null;
  if (elevenKey || openaiKey) {
    const providers: {
      elevenlabs?: ElevenLabsProvider;
      openai?: OpenAIVoiceProvider;
    } = {};
    if (elevenKey) {
      providers.elevenlabs = new ElevenLabsProvider({
        apiKey: elevenKey,
        defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? 'rachel',
      });
    }
    if (openaiKey) {
      providers.openai = new OpenAIVoiceProvider({ apiKey: openaiKey });
    }
    voice = createVoiceRouter({ providers, ledger: aiCostLedger });
  }

  return {
    marketplace: {
      listing: listingService,
      enquiry: enquiryService,
      tender: tenderService,
    },
    negotiation: negotiationService,
    waitlist: {
      service: waitlistService,
      vacancyHandler,
    },
    occupancyTimeline: occupancyTimelineService,
    stationMasterRouter,
    stationMasterCoverageRepo,
    renewal: renewalService,
    financialProfile: financialProfileService,
    riskReport: riskReportService,
    gamification: gamificationService,
    migration: migrationService,
    warehouse: warehouseService,
    maintenanceTaxonomy: maintenanceTaxonomyService,
    iot: iotService,
    featureFlags: featureFlagsService,
    gdpr: gdprService,
    aiCostLedger,
    llmRouter,
    buildBudgetGuardedAnthropicClient,
    arrears: {
      service: arrearsService,
      repo: arrearsRepo,
      ledgerPort: arrearsLedgerPort,
      entryLoader: arrearsEntryLoader,
    },
    cases: {
      service: caseService,
      repo: caseRepo,
    },
    // `mcp` is filled in by `buildServices` after the registry is
    // constructed, because the MCP server takes the populated registry
    // as input. We place a `null` here and patch it post-return.
    mcp: null,
    agentCertification,
    classroom,
    training,
    voice,
    orgAwareness: buildOrgAwareness(eventBus),
    autonomy: {
      // Live mode: Postgres-backed repository so tenants' policies
      // survive restarts and every mutation is chained into the
      // audit table (Wave 11).
      policyService: new AutonomyPolicyService({
        repository: new PostgresAutonomyPolicyRepository(db),
      }),
    },
    branding: {
      // Wave 27 Agent E — tenant branding. In-memory repo for now;
      // Postgres-backed impl can replace this by matching the narrow
      // `TenantBrandingRepository` interface. Overrides are non-critical
      // (defaults resolve cleanly) so data loss on restart is acceptable.
      service: new TenantBrandingService(new InMemoryTenantBrandingRepository()),
    },
    headBriefing: {
      // Wave 28 — head briefing composer. Live mode still uses in-memory
      // sources for now; the composer's port-based design lets us swap
      // individual sources (AutonomousActionAudit, ApprovalGrantService,
      // StrategicAdvisor, KPI warehouse, ambient-brain anomaly miner)
      // in iteratively without touching the router or the endpoint
      // contract. ExceptionInbox is shared with the Wave-13 autonomy
      // escalation-inbox pattern — an empty in-memory repo here keeps
      // the section shaped even before the Postgres adapter lands.
      composer: buildHeadBriefingComposer(
        new ExceptionInbox({ repository: new InMemoryExceptionRepository() }),
      ),
    },
    juniorAI: (() => {
      // Wave 28 — junior-AI factory. In-memory repo; the autonomy-policy
      // loader delegates to the live PolicyService so provisioned
      // juniors inherit each tenant's actual policy, not a default.
      const livePolicyService = new AutonomyPolicyService({
        repository: new PostgresAutonomyPolicyRepository(db),
      });
      return {
        factoryService: new JuniorAIFactoryService({
          repository: new InMemoryJuniorAIRepository(),
          autonomyPolicyLoader: (tenantId: string) =>
            livePolicyService.getPolicy(tenantId),
        }),
      };
    })(),
    // Canonical Property Graph — Neo4j-backed. Builder returns null when
    // NEO4J_URI is unset; the graph router degrades to 503 so live-mode
    // gateways without a Neo4j upstream still boot cleanly.
    graph: { queryService: buildGraphQueryService() },
    // Central Intelligence — the concrete LLM adapter lives in a
    // separate service. `agent` is only populated when `CI_LLM_URL`
    // env var is set AND the adapter is wired (follow-up PR); until
    // then the router returns 503 INTELLIGENCE_SERVICE_UNAVAILABLE.
    // Memory uses the in-memory default so in-session threads work.
    // TODO(wave-30): pgvector-backed ConversationMemory for prod.
    centralIntelligence: (() => {
      const memory = createInMemoryConversationMemory();
      const llmUrl = process.env.CI_LLM_URL?.trim();
      if (!llmUrl) {
        return { agent: null, memory };
      }
      // Adapter not shipped in-tree — the gateway consumes it over
      // HTTP from a dedicated service. Slot stays null until the
      // adapter lands; router keeps returning 503 cleanly.
      return { agent: null, memory };
    })(),
    // Property grading — Mr. Mwikila's A–F report card system.
    // Adapters live in domain-services (Postgres wiring); the service
    // class lives in ai-copilot (pure business logic). We compose here.
    propertyGrading: (() => {
      const adapters = createPropertyGradingAdapters(db);
      return new PropertyGrading.PropertyGradingService({
        metricsSource: adapters.metricsSource,
        weightsRepo: adapters.weightsRepo,
        snapshotRepo: adapters.snapshotRepo,
      });
    })(),
    // Tenant credit rating — FICO-scale 300-850 + CRB bands + portable
    // certificate. Postgres-backed repository pulls real invoice /
    // payment / tenancy data — zero mocks.
    creditRating: createCreditRatingService({
      repo: new PostgresCreditRatingRepository(db),
    }),
    // Wave 29 — forecasting (TGN + conformal). Only populated when
    // BOTH env vars are present. Otherwise the router returns 503
    // FORECAST_SERVICE_UNAVAILABLE. No mock / fallback forecaster
    // lives here — the package explicitly ships contracts, not
    // models.
    forecasting: (() => {
      const tgnUrl = process.env.TGN_INFERENCE_URL?.trim();
      const repoUrl = process.env.FORECASTING_REPO_URL?.trim();
      if (!tgnUrl || !repoUrl) {
        return { forecaster: null, featureExtractor: null, repository: null };
      }
      // The concrete TGN inference adapter, feature-extractor sources,
      // and repository adapter live in a follow-up deploy PR. We leave
      // the slot null even when env vars are set until those adapters
      // land, so the route still returns a clean 503 rather than a
      // partially-constructed forecaster. Flipping these to real
      // instances is an additive change only.
      return {
        forecaster: null,
        featureExtractor: null,
        repository: null,
      };
    })(),
    // Wave 26 — Agent Z2: four previously-unwired repos now live.
    sublease: {
      service: subleaseService,
      repo: subleaseRepo,
      tenantGroupRepo,
    },
    damageDeductions: {
      service: damageDeductionService,
      repo: damageDeductionRepo,
    },
    conditionalSurveys: {
      service: conditionalSurveyService,
      repo: conditionalSurveyRepo,
    },
    far: {
      service: farService,
      repo: farRepo,
    },
    // Wave 26 Z3 — Move-out checklist (step-based close-out workflow).
    // Postgres-backed via migration 0097. Null in degraded mode.
    moveOut: {
      service: new MoveOutChecklistService(new PostgresMoveOutRepository(db)),
    },
    // Wave 26 Z3 — Approval workflow. Request repo -> approval_requests (0097);
    // policy repo wraps approval_policies (0018) so per-tenant overrides kick
    // in transparently. Approver resolver left undefined for now — pending
    // user-directory port; service falls back gracefully.
    approvals: {
      service: new ApprovalWorkflowService(
        // Repo-interface pagination shape drifted (limit/offset vs
        // page/pageSize) across the domain-models upgrade. The service
        // itself is @ts-nocheck for the same reason; cast here to match.
        new PostgresApprovalRequestRepository(db) as unknown as never,
        new PostgresApprovalPolicyRepositoryAdapter(db) as unknown as never,
        eventBus,
      ),
    },
    eventBus,
    db,
    isLive: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function interpolatePositionalSql(
  sqlText: string,
  params: readonly unknown[],
): string {
  return sqlText.replace(/\$(\d+)/g, (_m, idxStr: string) => {
    const v = params[Number(idxStr) - 1];
    return encodeLiteral(v);
  });
}

function encodeLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
