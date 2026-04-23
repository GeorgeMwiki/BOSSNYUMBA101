/**
 * Vacancy-to-Lease pipeline router (Wave 27 Phase A agent PhA1).
 *
 * Mounted at `/api/v1/vacancy-pipeline`. Exposes the
 * `VacancyToLeaseOrchestrator` state machine as a REST surface so:
 *
 *   - Background subscribers on `UnitBecameVacant` can call
 *     `POST /:unitId/start` to open a run.
 *   - Operators can read state (`GET /:runId`), enumerate runs for a
 *     unit (`GET ?unitId=`), nudge the machine manually
 *     (`POST /:runId/advance`), and cancel (`POST /:runId/cancel`).
 *
 * The orchestrator is constructed lazily per request because the
 * composition root today does not pre-build one (it would force every
 * router to share a singleton). Instead we wrap the existing
 * service-registry services in narrow ports at request time — the cost
 * of each wrap is a no-op object construction. Future waves can migrate
 * this into the composition root once Wave 27 is stable.
 *
 * Every catch uses `routeCatch` so SQL constraint errors map to 4xx and
 * all other errors are redacted via `safeInternalError`.
 */

// @ts-nocheck — Hono v4 status-code literal union widening; see other routers.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { routeCatch, safeInternalError } from '../utils/safe-error';
// The orchestrators barrel namespaces each subtree, so we import the
// whole `VacancyToLease` namespace and dereference it at each use-site.
// This stays consistent with `monthly-close.router.ts`, which uses the
// same `import { MonthlyClose } from '...'` shape.
import { VacancyToLease } from '@bossnyumba/ai-copilot/orchestrators';

const VacancyToLeaseOrchestrator = VacancyToLease.VacancyToLeaseOrchestrator;
const InMemoryVacancyPipelineRunRepository =
  VacancyToLease.InMemoryVacancyPipelineRunRepository;
const VacancyPipelineError = VacancyToLease.VacancyPipelineError;
type OrchestratorCreditRatingPort = VacancyToLease.OrchestratorCreditRatingPort;
type OrchestratorEnquiryPort = VacancyToLease.OrchestratorEnquiryPort;
type OrchestratorEventPort = VacancyToLease.OrchestratorEventPort;
type OrchestratorInspectionPort = VacancyToLease.OrchestratorInspectionPort;
type OrchestratorListingPort = VacancyToLease.OrchestratorListingPort;
type OrchestratorNegotiationPort = VacancyToLease.OrchestratorNegotiationPort;
type OrchestratorPolicyPort = VacancyToLease.OrchestratorPolicyPort;
type OrchestratorRenewalPort = VacancyToLease.OrchestratorRenewalPort;
type OrchestratorWaitlistPort = VacancyToLease.OrchestratorWaitlistPort;
type VacancyPipelineRunRepository = VacancyToLease.VacancyPipelineRunRepository;
type VacancyPipelineEventType = VacancyToLease.VacancyPipelineEventType;

const app = new Hono();
app.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Repository — for Wave 27 we ship the in-memory repo per process. The
// Postgres-backed adapter lands in a follow-up once composition-root
// wiring is agreed (table already exists via migration 0098).
// TODO(WAVE-28+): swap for a Postgres-backed repository that reads/writes
// the `vacancy_pipeline_runs` table via the shared drizzle client.
// ---------------------------------------------------------------------------
const sharedRepo: VacancyPipelineRunRepository =
  new InMemoryVacancyPipelineRunRepository();

/**
 * Build an orchestrator instance bound to the current request's services
 * + tenant. Narrow adapters turn the existing domain services into the
 * shape expected by the orchestrator; missing services throw a clear
 * 503 via `unavailable()` upstream.
 */
function buildOrchestrator(c: any): VacancyToLeaseOrchestrator | null {
  const services = c.get('services') ?? {};
  const autonomy = services.autonomy?.policyService;
  if (!autonomy) return null;

  const correlationId = (c.get('requestId') as string | undefined) ?? `vpr_${Date.now()}`;

  const listingPort: OrchestratorListingPort = {
    async publishListing(tenantId, unitId, initiatedBy, corr) {
      const listing = services.marketplace?.listing;
      if (!listing) {
        // TODO(WAVE-28+): degrade cleanly when marketplace is offline.
        throw new Error('marketplace.listing service unavailable');
      }
      // The real `publish` returns a Result<Listing, Error>. We read
      // only the id here — upstream services already emit their own
      // events so the orchestrator doesn't need to re-emit.
      const result = await listing.publish(
        tenantId,
        {
          unitId,
          listingKind: 'unit_for_rent',
          headlinePrice: 0, // TODO(WAVE-28+): pull from unit's current asking rent
          currency: '', // ListingService fills from tenant region config
          negotiable: true,
          publishImmediately: true,
        } as any,
        initiatedBy,
        corr,
      );
      // Result<MarketplaceListing, MarketplaceServiceError> shape:
      const maybeListing = result?.ok ? result.value : null;
      if (!maybeListing) {
        throw new Error(
          result?.error?.message ?? 'marketplace.listing.publish returned no listing',
        );
      }
      return { listingId: maybeListing.id as string };
    },
  };

  const enquiryPort: OrchestratorEnquiryPort = {
    async latestApplicant() {
      // TODO(WAVE-28+): when EnquiryService exposes a query surface for
      // the highest-ranked enquirer per listing, wire it in here. For
      // now we return null so the orchestrator just bumps into
      // receiving_inquiries without populating applicantCustomerId —
      // operators can advance manually via POST /:runId/advance.
      return null;
    },
  };

  const creditRatingPort: OrchestratorCreditRatingPort = {
    async score(tenantId, customerId) {
      const rating = services.creditRating;
      if (!rating) {
        // TODO(WAVE-28+): fall back to a pending-review score instead of throwing.
        throw new Error('creditRating service unavailable');
      }
      const snapshot = await rating.computeRating(tenantId, customerId);
      return { score: snapshot.score };
    },
  };

  const negotiationPort: OrchestratorNegotiationPort = {
    async proposeOffer() {
      // TODO(WAVE-28+): wire to NegotiationService.startNegotiation with
      // the real offer inputs (policyId, opening offer, floor, ceiling).
      // For now the orchestrator merely records that an offer should
      // exist — the customer-app initiates the actual negotiation today.
      return { negotiationId: `pending_${Date.now()}` };
    },
  };

  const inspectionPort: OrchestratorInspectionPort = {
    async scheduleMoveInInspection() {
      // TODO(WAVE-28+): wire to the inspections router / service. For
      // today, the move-in inspection is created manually from the
      // estate-manager app; the orchestrator just records the transition.
      return { inspectionId: null };
    },
  };

  const renewalPort: OrchestratorRenewalPort = {
    async seedFirstTerm() {
      // TODO(WAVE-28+): call RenewalService.createInitialTerm when
      // available. Today leases are created through `/leases` directly.
      return { leaseId: null };
    },
  };

  const waitlistPort: OrchestratorWaitlistPort = {
    async markUnitFilled(tenantId, unitId) {
      const vacancyHandler = services.waitlist?.vacancyHandler;
      if (!vacancyHandler) return;
      // WaitlistVacancyHandler exposes a register/handle flow keyed on
      // the event bus; the best we can do without a direct `markFilled`
      // API is to emit a UnitFilled event on the orchestrator event
      // port instead. TODO(WAVE-28+): expose a first-class
      // `markUnitFilled(tenantId, unitId)` on WaitlistService.
      // For now this is a no-op that keeps the orchestrator compiling.
      return;
    },
  };

  const policyPort: OrchestratorPolicyPort = {
    async isAuthorized(tenantId, action, ctx) {
      const decision = await autonomy.isAuthorized(
        tenantId,
        'leasing',
        action,
        ctx as any,
      );
      return {
        authorized: decision.authorized,
        requiresApproval: decision.requiresApproval,
        reason: decision.reason,
      };
    },
  };

  const eventPort: OrchestratorEventPort = {
    async emit(evt) {
      const bus = services.eventBus;
      if (!bus || typeof bus.publish !== 'function') return;
      try {
        await bus.publish({
          event: {
            eventId: `vp_${Date.now()}`,
            eventType: evt.eventType,
            timestamp: new Date().toISOString(),
            tenantId: evt.tenantId,
            correlationId,
            causationId: null,
            metadata: {},
            payload: {
              runId: evt.runId,
              unitId: evt.unitId,
              state: evt.state,
              ...evt.payload,
            },
          } as any,
          version: 1,
          aggregateId: evt.runId,
          aggregateType: 'VacancyPipelineRun',
        });
      } catch {
        // Never let a bus failure tear down the transition.
      }
    },
  };

  return new VacancyToLeaseOrchestrator({
    repo: sharedRepo,
    listing: listingPort,
    enquiry: enquiryPort,
    creditRating: creditRatingPort,
    negotiation: negotiationPort,
    inspection: inspectionPort,
    renewal: renewalPort,
    waitlist: waitlistPort,
    policy: policyPort,
    events: eventPort,
  });
}

function unavailable(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'VACANCY_PIPELINE_UNAVAILABLE',
        message: 'Vacancy-pipeline orchestrator requires autonomy policy service.',
      },
    },
    503,
  );
}

function mapOrchestratorError(c: any, err: unknown) {
  if (err instanceof VacancyPipelineError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'INVALID_TRANSITION' || err.code === 'TERMINAL'
          ? 409
          : 400;
    return c.json(
      {
        success: false,
        error: { code: err.code, message: err.message },
      },
      status,
    );
  }
  return routeCatch(c, err, { code: 'VACANCY_PIPELINE_ERROR' });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const StartBodySchema = z
  .object({
    source: z.enum(['manual', 'unit_vacated_event', 'api']).optional(),
    correlationId: z.string().optional(),
  })
  .partial()
  .default({});

const AdvanceBodySchema = z.object({
  event: z.enum([
    'StartPipeline',
    'ListingPublished',
    'InquiryReceived',
    'ApplicantScreened',
    'OfferExtended',
    'OfferSigned',
    'OfferExpired',
    'ApplicantWithdrew',
    'ApplicantRejected',
    'MoveInScheduled',
    'LeaseActivated',
    'ApprovalGranted',
    'ApprovalDenied',
    'Cancelled',
  ]) as z.ZodType<VacancyPipelineEventType>,
  context: z.record(z.unknown()).optional(),
});

const CancelBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

const ListQuerySchema = z.object({
  unitId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.post(
  '/:unitId/start',
  zValidator('json', StartBodySchema),
  async (c) => {
    try {
      const orchestrator = buildOrchestrator(c);
      if (!orchestrator) return unavailable(c);
      const auth = c.get('auth');
      const unitId = c.req.param('unitId');
      const body = (c.req.valid as any)('json');
      const run = await orchestrator.startPipeline({
        tenantId: auth.tenantId,
        unitId,
        initiatedBy: auth.userId,
        source: body?.source,
        correlationId: body?.correlationId,
      });
      return c.json({ success: true, data: run }, 201);
    } catch (err) {
      return mapOrchestratorError(c, err);
    }
  },
);

app.get('/:runId', async (c) => {
  try {
    const orchestrator = buildOrchestrator(c);
    if (!orchestrator) return unavailable(c);
    const auth = c.get('auth');
    const runId = c.req.param('runId');
    const run = await orchestrator.getRun(auth.tenantId, runId);
    if (!run) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Run ${runId} not found.` },
        },
        404,
      );
    }
    return c.json({ success: true, data: run });
  } catch (err) {
    return safeInternalError(c, err, { code: 'VACANCY_PIPELINE_ERROR' });
  }
});

app.get('/', zValidator('query', ListQuerySchema), async (c) => {
  try {
    const orchestrator = buildOrchestrator(c);
    if (!orchestrator) return unavailable(c);
    const auth = c.get('auth');
    const query = (c.req.valid as any)('query');
    const runs = await orchestrator.listRuns(auth.tenantId, query.unitId);
    return c.json({ success: true, data: runs });
  } catch (err) {
    return safeInternalError(c, err, { code: 'VACANCY_PIPELINE_ERROR' });
  }
});

app.post(
  '/:runId/advance',
  zValidator('json', AdvanceBodySchema),
  async (c) => {
    try {
      const orchestrator = buildOrchestrator(c);
      if (!orchestrator) return unavailable(c);
      const auth = c.get('auth');
      const runId = c.req.param('runId');
      const body = (c.req.valid as any)('json');
      const run = await orchestrator.getRun(auth.tenantId, runId);
      if (!run) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: `Run ${runId} not found.` },
          },
          404,
        );
      }
      const next = await orchestrator.advance(
        run,
        body.event as VacancyPipelineEventType,
        auth.userId,
        (body.context ?? {}) as Record<string, unknown>,
      );
      return c.json({ success: true, data: next });
    } catch (err) {
      return mapOrchestratorError(c, err);
    }
  },
);

app.post(
  '/:runId/cancel',
  zValidator('json', CancelBodySchema),
  async (c) => {
    try {
      const orchestrator = buildOrchestrator(c);
      if (!orchestrator) return unavailable(c);
      const auth = c.get('auth');
      const runId = c.req.param('runId');
      const body = (c.req.valid as any)('json');
      const run = await orchestrator.cancelRun(
        auth.tenantId,
        runId,
        auth.userId,
        body.reason,
      );
      return c.json({ success: true, data: run });
    } catch (err) {
      return mapOrchestratorError(c, err);
    }
  },
);

export default app;
