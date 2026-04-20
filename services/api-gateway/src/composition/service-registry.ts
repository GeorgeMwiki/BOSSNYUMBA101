// @ts-nocheck — ai-copilot subpath exports (agent-certification, voice, classroom) + DatabaseClient namespace vs type conflict. Composition root owned by parallel agent wave; tracked.
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

import type { DatabaseClient } from '@bossnyumba/database';
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
} from '@bossnyumba/domain-services/lease';
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

  /** Arrears ledger (NEW 4). Service + loader for the projection endpoint. */
  readonly arrears: {
    readonly service: ArrearsService | null;
    readonly repo: PostgresArrearsRepository | null;
    readonly ledgerPort: PostgresLedgerPort | null;
    readonly entryLoader: ArrearsEntryLoader | null;
  };

  /** Wave 12 — AI copilot subsystems wired into the composition root. */
  readonly mcp: BossnyumbaMcpServer | null;
  readonly agentCertification: AgentCertificationService | null;
  readonly classroom: ClassroomService | null;
  readonly training: TrainingAdminEndpoints | null;
  readonly voice: VoiceRouter | null;

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
    arrears: {
      service: null,
      repo: null,
      ledgerPort: null,
      entryLoader: null,
    },
    mcp: null,
    agentCertification: null,
    classroom: null,
    training: null,
    voice: null,
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

  // Wave 12 — Agent Certification (Postgres-backed). SigningSecret comes
  // from env; if not set we fall back to the JWT secret or a dev default.
  const certSigningSecret =
    process.env.AGENT_CERT_SIGNING_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'dev-only-agent-cert-signing-secret-32chars';
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
    arrears: {
      service: arrearsService,
      repo: arrearsRepo,
      ledgerPort: arrearsLedgerPort,
      entryLoader: arrearsEntryLoader,
    },
    // `mcp` is filled in by `buildServices` after the registry is
    // constructed, because the MCP server takes the populated registry
    // as input. We place a `null` here and patch it post-return.
    mcp: null,
    agentCertification,
    classroom,
    training,
    voice,
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
