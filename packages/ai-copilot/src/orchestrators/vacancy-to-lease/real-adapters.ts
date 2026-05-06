/**
 * Real adapters for the VacancyToLeaseOrchestrator.
 *
 * Wires the orchestrator's nine ports to the concrete domain services
 * that exist today. Each adapter is built on a *narrow structural type*
 * (duck-typed deps) so this package does not need a hard dependency on
 * `@bossnyumba/domain-services`. The composition root (api-gateway)
 * passes the real service instances in; their surface only needs to
 * match the small `Real*Service` shapes declared here.
 *
 * Wiring matrix (current state of the codebase):
 *
 *   listing       — REAL_WIRED  → ListingService.publish
 *   enquiry       — DEFAULT     → No `latestApplicant(listingId)` query
 *                                 surface exists on EnquiryService today;
 *                                 its `startEnquiry` is the inverse
 *                                 direction of what the orchestrator
 *                                 needs. Falls through to the default.
 *   creditRating  — REAL_WIRED  → CreditRatingService.computeRating
 *   negotiation   — REAL_WIRED  → NegotiationService.startNegotiation
 *                                 (requires a tenant-level policy + an
 *                                 opening offer; both supplied by
 *                                 caller-provided resolvers).
 *   inspection    — REAL_WIRED  → InspectionService.scheduleInspection
 *                                 (requires propertyId + scheduledDate
 *                                 + inspectorId resolvers; falls back to
 *                                 the default if the resolver returns
 *                                 null).
 *   renewal       — DEFAULT     → RenewalService manages renewals of
 *                                 EXISTING leases. There is no
 *                                 `seedFirstTerm` flow — initial leases
 *                                 are created by the lease workflow,
 *                                 not the orchestrator. Stays default.
 *   waitlist      — DEFAULT     → Neither WaitlistService nor
 *                                 WaitlistVacancyHandler exposes a
 *                                 `markUnitFilled(tenantId, unitId)`
 *                                 method. We accept an optional callback
 *                                 in deps so the composition root can
 *                                 provide its own; otherwise default.
 *   policy        — REAL_WIRED  → AutonomyPolicyService.isAuthorized
 *                                 (bound to the 'leasing' domain).
 *   events        — REAL_WIRED  → EventBus.publish (wraps payload in
 *                                 the standard EventEnvelope shape).
 *
 * Migration path: when a future service lands (e.g. an EnquiryService
 * `latestApplicant` query, a `WaitlistService.markUnitFilled` method,
 * or a renewal `seedFirstTerm`), add the corresponding deps slot here
 * and a `createReal*Port` factory; the composition root just adds the
 * service to the deps bundle.
 */

import type {
  OrchestratorCreditRatingPort,
  OrchestratorEventPort,
  OrchestratorInspectionPort,
  OrchestratorListingPort,
  OrchestratorNegotiationPort,
  OrchestratorPolicyPort,
  OrchestratorWaitlistPort,
  VacancyToLeaseOrchestratorDeps,
} from './orchestrator-service.js';
import {
  createDefaultEnquiryPort,
  createDefaultEventPort,
  createDefaultInspectionPort,
  createDefaultListingPort,
  createDefaultNegotiationPort,
  createDefaultOrchestratorAdapters,
  createDefaultPolicyPort,
  createDefaultRenewalPort,
  createDefaultWaitlistPort,
  type DefaultAdaptersDeps,
} from './default-adapters.js';

// ---------------------------------------------------------------------------
// Narrow service-shape types — duck-typed so we don't need a hard
// dependency on @bossnyumba/domain-services or @bossnyumba/observability.
// Each shape is the smallest subset the adapter actually invokes.
// ---------------------------------------------------------------------------

/**
 * Subset of `ListingService.publish` we depend on.
 *
 * The real service returns `Result<MarketplaceListing, MarketplaceServiceError>`.
 * We accept the broader shape and read `ok` + `value.id` defensively so the
 * adapter survives schema drift.
 */
export interface RealListingService {
  publish(
    tenantId: string,
    input: {
      readonly unitId: string;
      readonly listingKind: string;
      readonly headlinePrice: number;
      readonly currency?: string;
      readonly negotiable?: boolean;
      readonly publishImmediately?: boolean;
      readonly negotiationPolicyId?: string | null;
      readonly propertyId?: string | null;
    },
    userId: string | null,
    correlationId: string,
  ): Promise<{
    readonly ok?: boolean;
    readonly value?: { readonly id: string };
    readonly error?: { readonly message?: string };
  }>;
}

/** Subset of `CreditRatingService.computeRating`. */
export interface RealCreditRatingService {
  computeRating(
    tenantId: string,
    customerId: string,
  ): Promise<{ readonly score: number }>;
}

/** Subset of `NegotiationService.startNegotiation`. */
export interface RealNegotiationService {
  startNegotiation(
    tenantId: string,
    input: {
      readonly policyId: string;
      readonly unitId?: string | null;
      readonly propertyId?: string | null;
      readonly prospectCustomerId?: string | null;
      readonly listingId?: string | null;
      readonly domain: 'lease_price' | 'tender_bid' | string;
      readonly openingOffer: number;
      readonly openingRationale?: string | null;
    },
    correlationId: string,
    actorUserId: string | null,
  ): Promise<{
    readonly success?: boolean;
    readonly data?: { readonly id: string };
    readonly error?: { readonly message?: string };
  }>;
}

/** Subset of `InspectionService.scheduleInspection`. */
export interface RealInspectionService {
  scheduleInspection(
    tenantId: string,
    propertyId: string,
    unitId: string,
    type: string,
    scheduledDate: string,
    inspectorId?: string,
    options?: {
      readonly createdBy?: string;
      readonly correlationId?: string;
      readonly scheduledTimeSlot?: string;
    },
  ): Promise<{
    readonly ok?: boolean;
    readonly value?: { readonly id: string };
    readonly error?: { readonly message?: string };
  }>;
}

/** Subset of `AutonomyPolicyService.isAuthorized`. */
export interface RealAutonomyPolicyService {
  isAuthorized(
    tenantId: string,
    domain: string,
    action: string,
    context?: Record<string, unknown>,
  ): Promise<{
    readonly authorized: boolean;
    readonly requiresApproval: boolean;
    readonly reason: string;
  }>;
}

/** Subset of an `EventBus` that accepts pre-built envelopes. */
export interface RealEventBus {
  publish(envelope: {
    readonly event: {
      readonly eventId: string;
      readonly eventType: string;
      readonly timestamp: string;
      readonly tenantId: string;
      readonly correlationId: string;
      readonly causationId: string | null;
      readonly metadata: Record<string, unknown>;
      readonly payload: Record<string, unknown>;
    };
    readonly version: number;
    readonly aggregateId: string;
    readonly aggregateType: string;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Resolver shapes — the orchestrator's port signatures don't carry every
// argument the underlying services need (e.g. propertyId for inspection,
// policyId for negotiation). The composition root supplies a small
// resolver per gap; if the resolver returns null/undefined the adapter
// transparently falls back to the conservative default.
// ---------------------------------------------------------------------------

export interface RealListingHints {
  /** Asking rent for the unit. Used as `headlinePrice` on the listing. */
  resolveHeadlinePrice(
    tenantId: string,
    unitId: string,
  ): Promise<number | null>;
  /** Tenant-region currency code (e.g. KES, TZS). */
  resolveCurrency(tenantId: string): Promise<string | null>;
  /** Optional negotiation policy to pre-attach. */
  resolveNegotiationPolicyId?(
    tenantId: string,
    unitId: string,
  ): Promise<string | null>;
  /** Property id when known up-front. */
  resolvePropertyId?(
    tenantId: string,
    unitId: string,
  ): Promise<string | null>;
  /** Listing kind override; defaults to `unit_for_rent`. */
  listingKind?: string;
}

export interface RealNegotiationHints {
  /**
   * Active negotiation policy for offers on this listing. The
   * orchestrator port carries `listingId` (not `unitId`) so the
   * resolver receives that — most implementations join through the
   * listing row to read the attached `negotiation_policy_id`.
   */
  resolvePolicyId(tenantId: string, listingId: string): Promise<string | null>;
  /** Opening offer (typically the listing's headlinePrice). */
  resolveOpeningOffer(
    tenantId: string,
    listingId: string,
    customerId: string,
  ): Promise<number | null>;
}

export interface RealInspectionHints {
  /** Resolve property id from the unit (FK lookup). */
  resolvePropertyId(tenantId: string, unitId: string): Promise<string | null>;
  /** ISO date for the move-in inspection. */
  resolveScheduledDate(
    tenantId: string,
    unitId: string,
    customerId: string,
  ): Promise<string | null>;
  /** Inspector to assign — typically the unit's estate manager. */
  resolveInspectorId(
    tenantId: string,
    unitId: string,
  ): Promise<string | null>;
  /** Inspection type override; defaults to `move_in`. */
  inspectionType?: string;
}

/** Optional first-class `markUnitFilled` callback for the waitlist port. */
export interface RealWaitlistMarkFilled {
  (tenantId: string, unitId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Per-port factories. Each accepts the relevant real service + (optional)
// resolvers and falls back to the conservative default when the
// underlying call fails or a resolver returns null.
// ---------------------------------------------------------------------------

const DEFAULT_LISTING_KIND = 'unit_for_rent';
const DEFAULT_INSPECTION_TYPE = 'move_in';

/**
 * Builds a `OrchestratorListingPort` backed by `ListingService.publish`.
 * Falls back to the synthetic-id default when the resolver cannot
 * provide an `headlinePrice` (publishing without one would be a
 * VALIDATION error from the real service).
 */
export function createRealListingAdapter(deps: {
  readonly service: RealListingService;
  readonly hints: RealListingHints;
  readonly defaults?: DefaultAdaptersDeps;
}): OrchestratorListingPort {
  const fallback = createDefaultListingPort(deps.defaults ?? {});
  return {
    async publishListing(tenantId, unitId, initiatedBy, correlationId) {
      const headlinePrice = await deps.hints.resolveHeadlinePrice(
        tenantId,
        unitId,
      );
      if (headlinePrice == null || headlinePrice <= 0) {
        return fallback.publishListing(tenantId, unitId, initiatedBy, correlationId);
      }
      const currency = (await deps.hints.resolveCurrency(tenantId)) ?? '';
      const negotiationPolicyId = deps.hints.resolveNegotiationPolicyId
        ? await deps.hints.resolveNegotiationPolicyId(tenantId, unitId)
        : null;
      const propertyId = deps.hints.resolvePropertyId
        ? await deps.hints.resolvePropertyId(tenantId, unitId)
        : null;

      const result = await deps.service.publish(
        tenantId,
        {
          unitId,
          listingKind: deps.hints.listingKind ?? DEFAULT_LISTING_KIND,
          headlinePrice,
          currency,
          negotiable: true,
          publishImmediately: true,
          negotiationPolicyId,
          propertyId,
        },
        initiatedBy,
        correlationId,
      );

      const listing = result?.ok ? result.value : null;
      if (!listing?.id) {
        throw new Error(
          result?.error?.message ?? 'ListingService.publish returned no listing',
        );
      }
      return { listingId: listing.id };
    },
  };
}

/**
 * Builds a `OrchestratorCreditRatingPort` backed by
 * `CreditRatingService.computeRating`. Errors propagate so the
 * orchestrator can surface SIDE_EFFECT_FAILED.
 */
export function createRealCreditRatingAdapter(deps: {
  readonly service: RealCreditRatingService;
}): OrchestratorCreditRatingPort {
  return {
    async score(tenantId, customerId) {
      const rating = await deps.service.computeRating(tenantId, customerId);
      return { score: rating.score };
    },
  };
}

/**
 * Builds a `OrchestratorNegotiationPort` backed by
 * `NegotiationService.startNegotiation`. Falls back to the default
 * when policyId or openingOffer cannot be resolved (the real service
 * requires both).
 */
export function createRealNegotiationAdapter(deps: {
  readonly service: RealNegotiationService;
  readonly hints: RealNegotiationHints;
  readonly defaults?: DefaultAdaptersDeps;
}): OrchestratorNegotiationPort {
  const fallback = createDefaultNegotiationPort(deps.defaults ?? {});
  return {
    async proposeOffer(tenantId, listingId, customerId, initiatedBy) {
      const [policyId, openingOffer] = await Promise.all([
        deps.hints.resolvePolicyId(tenantId, listingId),
        deps.hints.resolveOpeningOffer(tenantId, listingId, customerId),
      ]);
      if (!policyId || openingOffer == null || openingOffer <= 0) {
        return fallback.proposeOffer(tenantId, listingId, customerId, initiatedBy);
      }

      const result = await deps.service.startNegotiation(
        tenantId,
        {
          policyId,
          listingId,
          prospectCustomerId: customerId,
          domain: 'lease_price',
          openingOffer,
        },
        `vpr_${Date.now()}`,
        initiatedBy,
      );

      const negotiation = result?.success ? result.data : null;
      if (!negotiation?.id) {
        throw new Error(
          result?.error?.message ?? 'NegotiationService.startNegotiation returned no negotiation',
        );
      }
      return { negotiationId: negotiation.id };
    },
  };
}

/**
 * Builds a `OrchestratorInspectionPort` backed by
 * `InspectionService.scheduleInspection`. Falls back to the default
 * when resolvers cannot supply propertyId / scheduledDate / inspectorId.
 */
export function createRealInspectionAdapter(deps: {
  readonly service: RealInspectionService;
  readonly hints: RealInspectionHints;
  readonly defaults?: DefaultAdaptersDeps;
}): OrchestratorInspectionPort {
  const fallback = createDefaultInspectionPort(deps.defaults ?? {});
  return {
    async scheduleMoveInInspection(tenantId, unitId, customerId) {
      const [propertyId, scheduledDate, inspectorId] = await Promise.all([
        deps.hints.resolvePropertyId(tenantId, unitId),
        deps.hints.resolveScheduledDate(tenantId, unitId, customerId),
        deps.hints.resolveInspectorId(tenantId, unitId),
      ]);
      if (!propertyId || !scheduledDate || !inspectorId) {
        return fallback.scheduleMoveInInspection(tenantId, unitId, customerId);
      }
      const result = await deps.service.scheduleInspection(
        tenantId,
        propertyId,
        unitId,
        deps.hints.inspectionType ?? DEFAULT_INSPECTION_TYPE,
        scheduledDate,
        inspectorId,
        { createdBy: inspectorId },
      );
      const inspection = result?.ok ? result.value : null;
      if (!inspection?.id) {
        throw new Error(
          result?.error?.message ??
            'InspectionService.scheduleInspection returned no inspection',
        );
      }
      return { inspectionId: inspection.id };
    },
  };
}

/**
 * Builds a `OrchestratorPolicyPort` backed by
 * `AutonomyPolicyService.isAuthorized`, bound to the `'leasing'` domain.
 * The orchestrator's autonomy actions
 * (`publish_listing`, `approve_application`, `send_offer_letter`,
 * `approve_renewal`) are the documented leasing actions.
 */
export function createRealPolicyAdapter(deps: {
  readonly service: RealAutonomyPolicyService;
  readonly domain?: string;
}): OrchestratorPolicyPort {
  const domain = deps.domain ?? 'leasing';
  return {
    async isAuthorized(tenantId, action, context) {
      const decision = await deps.service.isAuthorized(
        tenantId,
        domain,
        action,
        context,
      );
      return {
        authorized: decision.authorized,
        requiresApproval: decision.requiresApproval,
        reason: decision.reason,
      };
    },
  };
}

/**
 * Builds a `OrchestratorEventPort` backed by an `EventBus.publish`.
 * Wraps the orchestrator's flat event payload in the EventEnvelope
 * shape (`event`, `version`, `aggregateId`, `aggregateType`) the
 * downstream observability + audit-trail subscribers expect.
 *
 * Bus failures are swallowed (orchestrator transitions must never be
 * blocked by an event-bus outage); the optional `onError` hook lets
 * the caller surface them in telemetry.
 */
export function createRealEventAdapter(deps: {
  readonly bus: RealEventBus;
  readonly correlationId?: () => string;
  readonly eventId?: () => string;
  readonly now?: () => string;
  readonly aggregateType?: string;
  readonly onError?: (err: unknown) => void;
}): OrchestratorEventPort {
  const correlationId = deps.correlationId ?? (() => `vp_corr_${Date.now()}`);
  const eventId = deps.eventId ?? (() => `evt_vp_${Date.now()}`);
  const now = deps.now ?? (() => new Date().toISOString());
  const aggregateType = deps.aggregateType ?? 'VacancyPipelineRun';

  return {
    async emit(event) {
      try {
        await deps.bus.publish({
          event: {
            eventId: eventId(),
            eventType: event.eventType,
            timestamp: now(),
            tenantId: event.tenantId,
            correlationId: correlationId(),
            causationId: null,
            metadata: {},
            payload: {
              runId: event.runId,
              unitId: event.unitId,
              state: event.state,
              ...event.payload,
            },
          },
          version: 1,
          aggregateId: event.runId,
          aggregateType,
        });
      } catch (err) {
        deps.onError?.(err);
        // Never let a bus failure tear down the transition.
      }
    },
  };
}

/**
 * Wraps an optional `markUnitFilled` callback into a
 * `OrchestratorWaitlistPort`. If no callback is supplied the default
 * (no-op) port is returned so existing behaviour is preserved.
 */
export function createRealWaitlistAdapter(deps: {
  readonly markFilled?: RealWaitlistMarkFilled;
  readonly defaults?: DefaultAdaptersDeps;
}): OrchestratorWaitlistPort {
  const fallback = createDefaultWaitlistPort(deps.defaults ?? {});
  if (!deps.markFilled) return fallback;
  const markFilled = deps.markFilled;
  return {
    async markUnitFilled(tenantId, unitId) {
      await markFilled(tenantId, unitId);
    },
  };
}

// ---------------------------------------------------------------------------
// Composite bundle — the production composition root passes whatever
// services it has wired and gets a partial adapter set; missing ports
// fall through to the conservative defaults.
// ---------------------------------------------------------------------------

export interface RealOrchestratorAdaptersDeps {
  readonly listing?: {
    readonly service: RealListingService;
    readonly hints: RealListingHints;
  };
  readonly creditRating?: {
    readonly service: RealCreditRatingService;
  };
  readonly negotiation?: {
    readonly service: RealNegotiationService;
    readonly hints: RealNegotiationHints;
  };
  readonly inspection?: {
    readonly service: RealInspectionService;
    readonly hints: RealInspectionHints;
  };
  readonly policy?: {
    readonly service: RealAutonomyPolicyService;
    readonly domain?: string;
  };
  readonly events?: {
    readonly bus: RealEventBus;
    readonly correlationId?: () => string;
    readonly eventId?: () => string;
    readonly now?: () => string;
    readonly aggregateType?: string;
    readonly onError?: (err: unknown) => void;
  };
  readonly waitlist?: {
    readonly markFilled?: RealWaitlistMarkFilled;
  };
  readonly defaults?: DefaultAdaptersDeps;
}

/**
 * Builds the full set of orchestrator adapters using real domain
 * services where deps are supplied, falling back to the conservative
 * defaults for everything else (enquiry, renewal, and any port whose
 * `service` slot is omitted).
 *
 * Compose at the api-gateway composition root:
 *
 *   const adapters = createRealOrchestratorAdapters({
 *     listing: { service: listingService, hints },
 *     creditRating: { service: creditRatingService },
 *     policy: { service: autonomyPolicyService },
 *     events: { bus: eventBus },
 *   });
 *   const orchestrator = new VacancyToLeaseOrchestrator({
 *     ...adapters,
 *     repo: pgVacancyPipelineRepo,
 *   });
 */
export function createRealOrchestratorAdapters(
  deps: RealOrchestratorAdaptersDeps,
): Omit<VacancyToLeaseOrchestratorDeps, 'repo'> {
  const defaultsBundle = createDefaultOrchestratorAdapters(deps.defaults ?? {});

  return {
    listing: deps.listing
      ? createRealListingAdapter({
          service: deps.listing.service,
          hints: deps.listing.hints,
          defaults: deps.defaults,
        })
      : defaultsBundle.listing,
    enquiry: defaultsBundle.enquiry, // DEFAULT_ONLY: see file header.
    creditRating: deps.creditRating
      ? createRealCreditRatingAdapter({ service: deps.creditRating.service })
      : defaultsBundle.creditRating,
    negotiation: deps.negotiation
      ? createRealNegotiationAdapter({
          service: deps.negotiation.service,
          hints: deps.negotiation.hints,
          defaults: deps.defaults,
        })
      : defaultsBundle.negotiation,
    inspection: deps.inspection
      ? createRealInspectionAdapter({
          service: deps.inspection.service,
          hints: deps.inspection.hints,
          defaults: deps.defaults,
        })
      : defaultsBundle.inspection,
    renewal: defaultsBundle.renewal, // DEFAULT_ONLY: see file header.
    waitlist: deps.waitlist?.markFilled
      ? createRealWaitlistAdapter({
          markFilled: deps.waitlist.markFilled,
          defaults: deps.defaults,
        })
      : defaultsBundle.waitlist,
    policy: deps.policy
      ? createRealPolicyAdapter({
          service: deps.policy.service,
          domain: deps.policy.domain,
        })
      : defaultsBundle.policy,
    events: deps.events
      ? createRealEventAdapter({
          bus: deps.events.bus,
          correlationId: deps.events.correlationId,
          eventId: deps.events.eventId,
          now: deps.events.now,
          aggregateType: deps.events.aggregateType,
          onError: deps.events.onError,
        })
      : defaultsBundle.events,
  };
}

// Re-exports so test files only need to import the file once.
export {
  createDefaultEnquiryPort,
  createDefaultRenewalPort,
  createDefaultPolicyPort,
  createDefaultEventPort,
};
