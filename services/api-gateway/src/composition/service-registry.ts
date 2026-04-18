// @ts-nocheck
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
// Occupancy + Routing types are imported for the ServiceRegistry type
// signature. No postgres-backed repo exists yet — the services are
// null-initialized and their routers fall back to 503.
import type { OccupancyTimelineService } from '@bossnyumba/domain-services/occupancy';
import type { StationMasterRouter } from '@bossnyumba/domain-services/routing';
import {
  createGamificationService,
  PostgresGamificationRepository,
} from '@bossnyumba/domain-services/gamification';
import {
  MigrationService,
  PostgresMigrationRepository,
} from '@bossnyumba/domain-services/migration';
import { InMemoryEventBus, type EventBus } from '@bossnyumba/domain-services';

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
  readonly gamification: ReturnType<typeof createGamificationService> | null;
  readonly migration: MigrationService | null;

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
    gamification: null,
    migration: null,
    eventBus,
    db: null,
    isLive: false,
  };
}

// ---------------------------------------------------------------------------
// buildServices — composition root
// ---------------------------------------------------------------------------

export function buildServices(input: BuildServicesInput): ServiceRegistry {
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

  const listingService = new ListingService({ repo: listingRepo, eventBus });
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

  // Occupancy timeline + station master router intentionally left null
  // until their Postgres repos land. Routers fall back to 503 cleanly.
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
    occupancyTimeline: null,
    stationMasterRouter: null,
    gamification: gamificationService,
    migration: migrationService,
    eventBus,
    db,
    isLive: true,
  };
}
