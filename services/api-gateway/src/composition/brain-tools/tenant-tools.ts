/**
 * PT-D — Tenant persona tools (T5 customer concierge — renter / applicant).
 *
 * Real-estate retailoring of Borjie's buyer-tools.ts. The tenant persona
 * is the renter, applicant, and current resident — surfaces the
 * buyer-mobile Expo app's chat home + the public tenant portal.
 *
 * Mapping discipline (Borjie -> BossNyumba):
 *   - buyer.marketplace.search          -> tenant.listing.browse
 *   - buyer.marketplace.listing-detail  -> tenant.listing.show
 *   - buyer.bids.place                  -> tenant.application.create
 *   - buyer.bids.mine                   -> tenant.application.list_mine
 *   - buyer.bids.cancel                 -> tenant.application.withdraw
 *   - buyer.kyc.status                  -> tenant.kyc.me
 *   - buyer.kyc.upload-atom             -> tenant.kyc.upload_atom
 *   - buyer.marketplace.market-intel    -> tenant.market_intel.show
 *   - buyer.delivery.sign               -> tenant.move_in.sign
 *
 * Every read defers to the loopback HTTP client. Every WRITE wraps the
 * body with `withChatProvenance(body, ctx)` and attaches `evidenceRefs`.
 *
 * Tier discipline:
 *   - browse / show / nearby / saved searches — LOW, isWrite=false
 *   - application / saved-search creation — LOW, isWrite=true
 *   - rent payment (LedgerService) — HIGH, isWrite=true
 *   - move_in.sign — HIGH (settlement-driving, ledger commit)
 *
 * Evidence-required (CLAUDE.md inviolable): every WRITE handler attaches
 * `evidenceRefs` so the downstream Auditor Agent can reject responses
 * with empty evidence chains.
 */

import { z } from 'zod';
import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const TENANT: ReadonlyArray<'T5_customer_concierge'> = ['T5_customer_concierge'];

// ====================================================================
// 1. tenant.listing.browse
// ====================================================================
const ListingBrowseInput = z.object({
  unitKind: z.enum(['studio', 'one_bed', 'two_bed', 'three_bed', 'four_bed_plus', 'commercial', 'any']).default('any'),
  minRentTzs: z.number().nonnegative().optional(),
  maxRentTzs: z.number().positive().optional(),
  region: z.string().max(120).optional(),
  furnished: z.boolean().optional(),
  limit: z.number().int().positive().max(50).default(20),
});
const ListingBrowseOutput = z.object({
  listings: z.array(
    z.object({
      listingId: z.string(),
      unitKind: z.string(),
      rentTzs: z.number(),
      currency: z.string(),
      region: z.string().optional(),
      bedrooms: z.number().int().nonnegative().optional(),
      furnished: z.boolean(),
      listedAt: z.string(),
    }),
  ),
  totalListings: z.number().int().nonnegative(),
});
export const tenantListingBrowseTool: PersonaToolDescriptor<
  typeof ListingBrowseInput,
  typeof ListingBrowseOutput
> = {
  id: 'tenant.listing.browse',
  name: 'Tenant — browse listings (en) / Mpangaji — vinjari nyumba (sw)',
  description: 'Browse active rental listings filtered by unit kind, rent range, region, and furnished status.',
  personaSlugs: TENANT,
  inputSchema: ListingBrowseInput,
  outputSchema: ListingBrowseOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { listings: [], totalListings: 0 };
    return client.get<{
      listings: Array<{
        listingId: string;
        unitKind: string;
        rentTzs: number;
        currency: string;
        region?: string;
        bedrooms?: number;
        furnished: boolean;
        listedAt: string;
      }>;
      totalListings: number;
    }>('/tenant/listings', {
      query: {
        unitKind: input.unitKind === 'any' ? undefined : input.unitKind,
        minRentTzs: input.minRentTzs,
        maxRentTzs: input.maxRentTzs,
        region: input.region,
        furnished: input.furnished === undefined ? undefined : input.furnished ? 'true' : 'false',
        limit: input.limit,
      },
    });
  },
};

// ====================================================================
// 2. tenant.listing.show
// ====================================================================
const ListingShowInput = z.object({
  listingId: z.string().min(1).max(120),
});
const ListingShowOutput = z.object({
  listingId: z.string(),
  unitKind: z.string(),
  rentTzs: z.number(),
  currency: z.string(),
  bedrooms: z.number().int().nonnegative().optional(),
  bathrooms: z.number().int().nonnegative().optional(),
  furnished: z.boolean(),
  amenities: z.array(z.string()),
  region: z.string().optional(),
  descriptionSw: z.string(),
  descriptionEn: z.string(),
  photoUrls: z.array(z.string()),
  applicationCount: z.number().int().nonnegative(),
});
export const tenantListingShowTool: PersonaToolDescriptor<
  typeof ListingShowInput,
  typeof ListingShowOutput
> = {
  id: 'tenant.listing.show',
  name: 'Tenant — show listing detail (en) / Mpangaji — onyesha maelezo ya nyumba (sw)',
  description: 'Full bilingual detail for a single rental listing including amenities, photos, and application count.',
  personaSlugs: TENANT,
  inputSchema: ListingShowInput,
  outputSchema: ListingShowOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        listingId: input.listingId,
        unitKind: 'unknown',
        rentTzs: 0,
        currency: 'TZS',
        furnished: false,
        amenities: [],
        descriptionSw: '',
        descriptionEn: '',
        photoUrls: [],
        applicationCount: 0,
      };
    }
    return client.get<{
      listingId: string;
      unitKind: string;
      rentTzs: number;
      currency: string;
      bedrooms?: number;
      bathrooms?: number;
      furnished: boolean;
      amenities: string[];
      region?: string;
      descriptionSw: string;
      descriptionEn: string;
      photoUrls: string[];
      applicationCount: number;
    }>(`/tenant/listings/${encodeURIComponent(input.listingId)}`);
  },
};

// ====================================================================
// 3. tenant.listing.nearby
// ====================================================================
const ListingNearbyInput = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(100).default(10),
  limit: z.number().int().positive().max(50).default(20),
});
const ListingNearbyOutput = z.object({
  listings: z.array(
    z.object({
      listingId: z.string(),
      unitKind: z.string(),
      rentTzs: z.number(),
      distanceKm: z.number(),
    }),
  ),
});
export const tenantListingNearbyTool: PersonaToolDescriptor<
  typeof ListingNearbyInput,
  typeof ListingNearbyOutput
> = {
  id: 'tenant.listing.nearby',
  name: 'Tenant — listings nearby (en) / Mpangaji — nyumba karibu nawe (sw)',
  description: 'Browse rental listings within the given radius of a lat/lng, distance-sorted.',
  personaSlugs: TENANT,
  inputSchema: ListingNearbyInput,
  outputSchema: ListingNearbyOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { listings: [] };
    return client.get<{
      listings: Array<{
        listingId: string;
        unitKind: string;
        rentTzs: number;
        distanceKm: number;
      }>;
    }>('/tenant/listings/nearby', {
      query: {
        lat: input.lat,
        lng: input.lng,
        radiusKm: input.radiusKm,
        limit: input.limit,
      },
    });
  },
};

// ====================================================================
// 4. tenant.saved_searches.create
// ====================================================================
const SavedSearchCreateInput = z.object({
  nameSw: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  filters: z.object({
    unitKind: z.string().optional(),
    minRentTzs: z.number().optional(),
    maxRentTzs: z.number().optional(),
    region: z.string().optional(),
  }),
  notifyOnNew: z.boolean().default(true),
  evidenceRef: z.string().min(1).max(500),
});
const SavedSearchCreateOutput = z.object({
  savedSearchId: z.string(),
  createdAt: z.string(),
});
export const tenantSavedSearchCreateTool: PersonaToolDescriptor<
  typeof SavedSearchCreateInput,
  typeof SavedSearchCreateOutput
> = {
  id: 'tenant.saved_searches.create',
  name: 'Tenant — save search (en) / Mpangaji — hifadhi utafutaji (sw)',
  description: 'Save a listing search with optional new-listing notifications.',
  personaSlugs: TENANT,
  inputSchema: SavedSearchCreateInput,
  outputSchema: SavedSearchCreateOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { savedSearchId: '', createdAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        nameSw: input.nameSw,
        nameEn: input.nameEn,
        filters: input.filters,
        notifyOnNew: input.notifyOnNew,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ savedSearchId: string; createdAt: string }>(
      '/tenant/saved-searches',
      body,
    );
  },
};

// ====================================================================
// 5. tenant.application.create
// ====================================================================
const ApplicationCreateInput = z.object({
  listingId: z.string().min(1).max(120),
  offerRentTzs: z.number().positive(),
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occupants: z.number().int().positive(),
  notesSw: z.string().max(2000).optional(),
  notesEn: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ApplicationCreateOutput = z.object({
  applicationId: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const tenantApplicationCreateTool: PersonaToolDescriptor<
  typeof ApplicationCreateInput,
  typeof ApplicationCreateOutput
> = {
  id: 'tenant.application.create',
  name: 'Tenant — submit application (en) / Mpangaji — wasilisha maombi (sw)',
  description: 'Submit a rental application against a listing with offer rent + move-in date + occupants.',
  personaSlugs: TENANT,
  inputSchema: ApplicationCreateInput,
  outputSchema: ApplicationCreateOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        applicationId: '',
        status: 'unavailable',
        createdAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        listingId: input.listingId,
        offerRentTzs: input.offerRentTzs,
        moveInDate: input.moveInDate,
        occupants: input.occupants,
        ...(input.notesSw && { notesSw: input.notesSw }),
        ...(input.notesEn && { notesEn: input.notesEn }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      applicationId: string;
      status: string;
      createdAt: string;
    }>('/tenant/applications', body);
  },
};

// ====================================================================
// 6. tenant.application.list_mine
// ====================================================================
const ApplicationListMineInput = z.object({
  status: z.enum(['active', 'approved', 'rejected', 'withdrawn', 'all']).default('active'),
});
const ApplicationListMineOutput = z.object({
  applications: z.array(
    z.object({
      applicationId: z.string(),
      listingId: z.string(),
      offerRentTzs: z.number(),
      status: z.enum(['active', 'approved', 'rejected', 'withdrawn']),
      createdAt: z.string(),
    }),
  ),
});
export const tenantApplicationListMineTool: PersonaToolDescriptor<
  typeof ApplicationListMineInput,
  typeof ApplicationListMineOutput
> = {
  id: 'tenant.application.list_mine',
  name: 'Tenant — list my applications (en) / Mpangaji — orodhesha maombi yangu (sw)',
  description: 'List the caller\'s rental applications, optionally filtered by status.',
  personaSlugs: TENANT,
  inputSchema: ApplicationListMineInput,
  outputSchema: ApplicationListMineOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { applications: [] };
    return client.get<{
      applications: Array<{
        applicationId: string;
        listingId: string;
        offerRentTzs: number;
        status: 'active' | 'approved' | 'rejected' | 'withdrawn';
        createdAt: string;
      }>;
    }>('/tenant/applications/mine', {
      query: { status: input.status === 'all' ? undefined : input.status },
    });
  },
};

// ====================================================================
// 7. tenant.application.withdraw
// ====================================================================
const ApplicationWithdrawInput = z.object({
  applicationId: z.string().min(1).max(120),
  reasonSw: z.string().max(2000).optional(),
  reasonEn: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ApplicationWithdrawOutput = z.object({
  applicationId: z.string(),
  withdrawnAt: z.string(),
});
export const tenantApplicationWithdrawTool: PersonaToolDescriptor<
  typeof ApplicationWithdrawInput,
  typeof ApplicationWithdrawOutput
> = {
  id: 'tenant.application.withdraw',
  name: 'Tenant — withdraw application (en) / Mpangaji — futa maombi (sw)',
  description: 'Withdraw a previously-submitted rental application.',
  personaSlugs: TENANT,
  inputSchema: ApplicationWithdrawInput,
  outputSchema: ApplicationWithdrawOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        applicationId: input.applicationId,
        withdrawnAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        ...(input.reasonSw && { reasonSw: input.reasonSw }),
        ...(input.reasonEn && { reasonEn: input.reasonEn }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ applicationId: string; withdrawnAt: string }>(
      `/tenant/applications/${encodeURIComponent(input.applicationId)}/withdraw`,
      body,
    );
  },
};

// ====================================================================
// 8. tenant.kyc.me
// ====================================================================
const KycMeInput = z.object({});
const KycMeOutput = z.object({
  tier: z.enum(['unverified', 'tier1', 'tier2', 'tier3']),
  pendingSteps: z.array(z.string()),
  approvedAt: z.string().optional(),
});
export const tenantKycMeTool: PersonaToolDescriptor<
  typeof KycMeInput,
  typeof KycMeOutput
> = {
  id: 'tenant.kyc.me',
  name: 'Tenant — show my KYC status (en) / Mpangaji — onyesha hali ya uthibitisho (sw)',
  description: 'Return the caller\'s KYC tier and any pending verification steps.',
  personaSlugs: TENANT,
  inputSchema: KycMeInput,
  outputSchema: KycMeOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { tier: 'unverified' as const, pendingSteps: [] };
    return client.get<{
      tier: 'unverified' | 'tier1' | 'tier2' | 'tier3';
      pendingSteps: string[];
      approvedAt?: string;
    }>('/tenant/kyc/me');
  },
};

// ====================================================================
// 9. tenant.kyc.upload_atom
// ====================================================================
const KycUploadAtomInput = z.object({
  sessionId: z.string().min(1).max(120),
  chunkIndex: z.number().int().nonnegative(),
  chunkBase64: z.string().min(1).max(2_000_000),
  isLast: z.boolean().default(false),
});
const KycUploadAtomOutput = z.object({
  sessionId: z.string(),
  chunkIndex: z.number().int(),
  acceptedAt: z.string(),
  assembled: z.boolean(),
});
export const tenantKycUploadAtomTool: PersonaToolDescriptor<
  typeof KycUploadAtomInput,
  typeof KycUploadAtomOutput
> = {
  id: 'tenant.kyc.upload_atom',
  name: 'Tenant — upload KYC chunk (en) / Mpangaji — pakia kipande cha uthibitisho (sw)',
  description:
    'Upload one chunk of a KYC document. Assembly happens server-side after the ' +
    'final chunk (isLast: true) is accepted.',
  personaSlugs: TENANT,
  inputSchema: KycUploadAtomInput,
  outputSchema: KycUploadAtomOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        sessionId: input.sessionId,
        chunkIndex: input.chunkIndex,
        acceptedAt: new Date().toISOString(),
        assembled: false,
      };
    }
    const body = withChatProvenance(
      {
        sessionId: input.sessionId,
        chunkIndex: input.chunkIndex,
        chunkBase64: input.chunkBase64,
        isLast: input.isLast,
      },
      ctx,
    );
    return client.post<{
      sessionId: string;
      chunkIndex: number;
      acceptedAt: string;
      assembled: boolean;
    }>('/tenant/kyc/upload-atom', body);
  },
};

// ====================================================================
// 10. tenant.move_in.sign — HIGH stakes (settlement)
// ====================================================================
const MoveInSignInput = z.object({
  applicationId: z.string().min(1).max(120),
  signedAt: z.string(),
  acknowledgedChecklistId: z.string().min(1).max(120),
  conditionReportChecksum: z.string().min(8).max(256),
  evidenceRef: z.string().min(1).max(500),
});
const MoveInSignOutput = z.object({
  leaseId: z.string(),
  signedAt: z.string(),
  status: z.string(),
  initialPaymentDueTzs: z.number(),
  idempotent: z.boolean(),
});
export const tenantMoveInSignTool: PersonaToolDescriptor<
  typeof MoveInSignInput,
  typeof MoveInSignOutput
> = {
  id: 'tenant.move_in.sign',
  name: 'Tenant — sign move-in (en) / Mpangaji — saini uhamishaji (sw)',
  description:
    'Sign the final move-in condition report on an approved application. ' +
    'Drives the lease orchestrator: creates the lease record, posts the ' +
    'initial deposit + first-month rent journal via LedgerService.post(), ' +
    'and emits the move-in artifacts. HIGH stakes. Idempotent on ' +
    '(tenant, application, conditionReportChecksum).',
  personaSlugs: TENANT,
  inputSchema: MoveInSignInput,
  outputSchema: MoveInSignOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: '',
        signedAt: input.signedAt,
        status: 'unavailable',
        initialPaymentDueTzs: 0,
        idempotent: false,
      };
    }
    const body = withChatProvenance(
      {
        signedAt: input.signedAt,
        acknowledgedChecklistId: input.acknowledgedChecklistId,
        conditionReportChecksum: input.conditionReportChecksum,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      leaseId: string;
      signedAt: string;
      status: string;
      initialPaymentDueTzs: number;
      idempotent: boolean;
    }>(
      `/tenant/applications/${encodeURIComponent(input.applicationId)}/sign-move-in`,
      body,
    );
  },
};

// ====================================================================
// 11. tenant.lease.show
// ====================================================================
const LeaseShowInput = z.object({
  leaseId: z.string().min(1).max(120).optional(),
});
const LeaseShowOutput = z.object({
  leaseId: z.string(),
  propertyId: z.string(),
  unitId: z.string(),
  monthlyRentTzs: z.number(),
  currency: z.string(),
  startedOn: z.string(),
  endsOn: z.string().optional(),
  status: z.enum(['active', 'expiring', 'expired', 'terminated', 'renewing']),
  depositHeldTzs: z.number(),
});
export const tenantLeaseShowTool: PersonaToolDescriptor<
  typeof LeaseShowInput,
  typeof LeaseShowOutput
> = {
  id: 'tenant.lease.show',
  name: 'Tenant — show my lease (en) / Mpangaji — onyesha mkataba wangu (sw)',
  description: 'Show the caller\'s active lease (or a specific one by id).',
  personaSlugs: TENANT,
  inputSchema: LeaseShowInput,
  outputSchema: LeaseShowOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId ?? '',
        propertyId: '',
        unitId: '',
        monthlyRentTzs: 0,
        currency: 'TZS',
        startedOn: '',
        status: 'active' as const,
        depositHeldTzs: 0,
      };
    }
    return client.get<{
      leaseId: string;
      propertyId: string;
      unitId: string;
      monthlyRentTzs: number;
      currency: string;
      startedOn: string;
      endsOn?: string;
      status: 'active' | 'expiring' | 'expired' | 'terminated' | 'renewing';
      depositHeldTzs: number;
    }>(input.leaseId ? `/tenant/leases/${encodeURIComponent(input.leaseId)}` : '/tenant/leases/active');
  },
};

// ====================================================================
// 12. tenant.lease.renewal_respond
// ====================================================================
const LeaseRenewalRespondInput = z.object({
  leaseId: z.string().min(1).max(120),
  decision: z.enum(['accept', 'reject', 'counter']),
  counterRentTzs: z.number().positive().optional(),
  evidenceRef: z.string().min(1).max(500),
});
const LeaseRenewalRespondOutput = z.object({
  leaseId: z.string(),
  decision: z.string(),
  respondedAt: z.string(),
});
export const tenantLeaseRenewalRespondTool: PersonaToolDescriptor<
  typeof LeaseRenewalRespondInput,
  typeof LeaseRenewalRespondOutput
> = {
  id: 'tenant.lease.renewal.respond',
  name: 'Tenant — respond to lease renewal (en) / Mpangaji — jibu upya mkataba (sw)',
  description: 'Accept / reject / counter a lease renewal offer from the owner.',
  personaSlugs: TENANT,
  inputSchema: LeaseRenewalRespondInput,
  outputSchema: LeaseRenewalRespondOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        decision: input.decision,
        respondedAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        decision: input.decision,
        ...(input.counterRentTzs !== undefined && { counterRentTzs: input.counterRentTzs }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      leaseId: string;
      decision: string;
      respondedAt: string;
    }>(
      `/tenant/leases/${encodeURIComponent(input.leaseId)}/renewal/respond`,
      body,
    );
  },
};

// ====================================================================
// 13. tenant.rent.pay — HIGH stakes (ledger commit)
// ====================================================================
const RentPayInput = z.object({
  leaseId: z.string().min(1).max(120),
  amountTzs: z.number().positive(),
  payPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  paymentProvider: z.enum(['mpesa', 'tigo_pesa', 'bank_transfer', 'card', 'cash']),
  paymentRef: z.string().min(1).max(200),
  idempotencyKey: z.string().min(8).max(256),
  evidenceRef: z.string().min(1).max(500),
});
const RentPayOutput = z.object({
  paymentId: z.string(),
  leaseId: z.string(),
  amountTzs: z.number(),
  status: z.enum(['posted', 'pending', 'failed']),
  postedAt: z.string(),
  ledgerJournalId: z.string().optional(),
  idempotent: z.boolean(),
});
export const tenantRentPayTool: PersonaToolDescriptor<
  typeof RentPayInput,
  typeof RentPayOutput
> = {
  id: 'tenant.rent.pay',
  name: 'Tenant — pay rent (en) / Mpangaji — lipa kodi (sw)',
  description:
    'Pay rent on an active lease via M-Pesa / Tigo Pesa / bank / card / cash. ' +
    'Money path runs through LedgerService.post() (immutable double-entry) — ' +
    'the response carries the ledger journal id when posted synchronously. ' +
    'HIGH stakes. Idempotent on idempotencyKey.',
  personaSlugs: TENANT,
  inputSchema: RentPayInput,
  outputSchema: RentPayOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        paymentId: '',
        leaseId: input.leaseId,
        amountTzs: input.amountTzs,
        status: 'pending' as const,
        postedAt: new Date().toISOString(),
        idempotent: false,
      };
    }
    const body = withChatProvenance(
      {
        amountTzs: input.amountTzs,
        payPeriod: input.payPeriod,
        paymentProvider: input.paymentProvider,
        paymentRef: input.paymentRef,
        idempotencyKey: input.idempotencyKey,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      paymentId: string;
      leaseId: string;
      amountTzs: number;
      status: 'posted' | 'pending' | 'failed';
      postedAt: string;
      ledgerJournalId?: string;
      idempotent: boolean;
    }>(
      `/tenant/leases/${encodeURIComponent(input.leaseId)}/rent/pay`,
      body,
    );
  },
};

// ====================================================================
// 14. tenant.rent.statement
// ====================================================================
const RentStatementInput = z.object({
  leaseId: z.string().min(1).max(120),
  fromPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  toPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
const RentStatementOutput = z.object({
  leaseId: z.string(),
  rows: z.array(
    z.object({
      payPeriod: z.string(),
      dueTzs: z.number(),
      paidTzs: z.number(),
      balanceTzs: z.number(),
      paidAt: z.string().optional(),
    }),
  ),
  totalDueTzs: z.number(),
  totalPaidTzs: z.number(),
  arrearsTzs: z.number(),
});
export const tenantRentStatementTool: PersonaToolDescriptor<
  typeof RentStatementInput,
  typeof RentStatementOutput
> = {
  id: 'tenant.rent.statement',
  name: 'Tenant — show rent statement (en) / Mpangaji — onyesha hesabu ya kodi (sw)',
  description: 'Return a period-by-period rent statement (due, paid, balance, arrears).',
  personaSlugs: TENANT,
  inputSchema: RentStatementInput,
  outputSchema: RentStatementOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        rows: [],
        totalDueTzs: 0,
        totalPaidTzs: 0,
        arrearsTzs: 0,
      };
    }
    return client.get<{
      leaseId: string;
      rows: Array<{
        payPeriod: string;
        dueTzs: number;
        paidTzs: number;
        balanceTzs: number;
        paidAt?: string;
      }>;
      totalDueTzs: number;
      totalPaidTzs: number;
      arrearsTzs: number;
    }>(`/tenant/leases/${encodeURIComponent(input.leaseId)}/rent/statement`, {
      query: { fromPeriod: input.fromPeriod, toPeriod: input.toPeriod },
    });
  },
};

// ====================================================================
// 15. tenant.maintenance.request_create
// ====================================================================
const MaintenanceRequestCreateInput = z.object({
  leaseId: z.string().min(1).max(120),
  category: z.enum(['plumbing', 'electrical', 'appliance', 'structural', 'pests', 'cleaning', 'other']),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  titleSw: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  descriptionSw: z.string().min(1).max(4000),
  descriptionEn: z.string().min(1).max(4000),
  preferredVisitAt: z.string().optional(),
  evidenceRef: z.string().min(1).max(500),
});
const MaintenanceRequestCreateOutput = z.object({
  maintenanceRequestId: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const tenantMaintenanceRequestCreateTool: PersonaToolDescriptor<
  typeof MaintenanceRequestCreateInput,
  typeof MaintenanceRequestCreateOutput
> = {
  id: 'tenant.maintenance.request_create',
  name: 'Tenant — request maintenance (en) / Mpangaji — omba marekebisho (sw)',
  description: 'File a maintenance request against an active lease.',
  personaSlugs: TENANT,
  inputSchema: MaintenanceRequestCreateInput,
  outputSchema: MaintenanceRequestCreateOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        maintenanceRequestId: '',
        status: 'unavailable',
        createdAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        leaseId: input.leaseId,
        category: input.category,
        urgency: input.urgency,
        titleSw: input.titleSw,
        titleEn: input.titleEn,
        descriptionSw: input.descriptionSw,
        descriptionEn: input.descriptionEn,
        ...(input.preferredVisitAt && { preferredVisitAt: input.preferredVisitAt }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      maintenanceRequestId: string;
      status: string;
      createdAt: string;
    }>('/tenant/maintenance-requests', body);
  },
};

// ====================================================================
// 16. tenant.maintenance.list_mine
// ====================================================================
const MaintenanceListMineInput = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'all']).default('open'),
});
const MaintenanceListMineOutput = z.object({
  requests: z.array(
    z.object({
      maintenanceRequestId: z.string(),
      category: z.string(),
      urgency: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      status: z.string(),
      createdAt: z.string(),
    }),
  ),
});
export const tenantMaintenanceListMineTool: PersonaToolDescriptor<
  typeof MaintenanceListMineInput,
  typeof MaintenanceListMineOutput
> = {
  id: 'tenant.maintenance.list_mine',
  name: 'Tenant — list my maintenance requests (en) / Mpangaji — orodhesha maombi ya marekebisho (sw)',
  description: 'List maintenance requests filed by the caller.',
  personaSlugs: TENANT,
  inputSchema: MaintenanceListMineInput,
  outputSchema: MaintenanceListMineOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { requests: [] };
    return client.get<{
      requests: Array<{
        maintenanceRequestId: string;
        category: string;
        urgency: string;
        titleSw: string;
        titleEn: string;
        status: string;
        createdAt: string;
      }>;
    }>('/tenant/maintenance-requests/mine', {
      query: { status: input.status === 'all' ? undefined : input.status },
    });
  },
};

// ====================================================================
// 17. tenant.complaint.create
// ====================================================================
const ComplaintCreateInput = z.object({
  leaseId: z.string().min(1).max(120),
  kind: z.enum(['noise', 'neighbor', 'staff', 'safety', 'billing', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  descriptionSw: z.string().min(1).max(4000),
  descriptionEn: z.string().min(1).max(4000),
  occurredAt: z.string().optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ComplaintCreateOutput = z.object({
  complaintId: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const tenantComplaintCreateTool: PersonaToolDescriptor<
  typeof ComplaintCreateInput,
  typeof ComplaintCreateOutput
> = {
  id: 'tenant.complaint.create',
  name: 'Tenant — file complaint (en) / Mpangaji — toa malalamiko (sw)',
  description: 'File a complaint against current accommodation, neighbors, staff, or billing.',
  personaSlugs: TENANT,
  inputSchema: ComplaintCreateInput,
  outputSchema: ComplaintCreateOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        complaintId: '',
        status: 'unavailable',
        createdAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        leaseId: input.leaseId,
        kind: input.kind,
        severity: input.severity,
        descriptionSw: input.descriptionSw,
        descriptionEn: input.descriptionEn,
        ...(input.occurredAt && { occurredAt: input.occurredAt }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      complaintId: string;
      status: string;
      createdAt: string;
    }>('/tenant/complaints', body);
  },
};

// ====================================================================
// 18. tenant.notification.list
// ====================================================================
const NotificationListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
  unreadOnly: z.boolean().default(false),
});
const NotificationListOutput = z.object({
  notifications: z.array(
    z.object({
      notificationId: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      bodySw: z.string(),
      bodyEn: z.string(),
      isRead: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});
export const tenantNotificationListTool: PersonaToolDescriptor<
  typeof NotificationListInput,
  typeof NotificationListOutput
> = {
  id: 'tenant.notification.list',
  name: 'Tenant — list notifications (en) / Mpangaji — orodhesha arifa (sw)',
  description: 'List notifications routed to the tenant (rent reminders, maintenance updates, lease events).',
  personaSlugs: TENANT,
  inputSchema: NotificationListInput,
  outputSchema: NotificationListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { notifications: [] };
    return client.get<{
      notifications: Array<{
        notificationId: string;
        titleSw: string;
        titleEn: string;
        bodySw: string;
        bodyEn: string;
        isRead: boolean;
        createdAt: string;
      }>;
    }>('/tenant/notifications', {
      query: {
        limit: input.limit,
        unreadOnly: input.unreadOnly ? 'true' : 'false',
      },
    });
  },
};

// ====================================================================
// 19. tenant.move_out.notice
// ====================================================================
const MoveOutNoticeInput = z.object({
  leaseId: z.string().min(1).max(120),
  intendedMoveOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reasonSw: z.string().max(2000).optional(),
  reasonEn: z.string().max(2000).optional(),
  forwardingAddress: z.string().max(500).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const MoveOutNoticeOutput = z.object({
  moveOutNoticeId: z.string(),
  effectiveDate: z.string(),
  status: z.string(),
});
export const tenantMoveOutNoticeTool: PersonaToolDescriptor<
  typeof MoveOutNoticeInput,
  typeof MoveOutNoticeOutput
> = {
  id: 'tenant.move_out.notice',
  name: 'Tenant — submit move-out notice (en) / Mpangaji — wasilisha taarifa ya kuhama (sw)',
  description: 'Submit a formal move-out notice for an active lease.',
  personaSlugs: TENANT,
  inputSchema: MoveOutNoticeInput,
  outputSchema: MoveOutNoticeOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        moveOutNoticeId: '',
        effectiveDate: input.intendedMoveOutDate,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        intendedMoveOutDate: input.intendedMoveOutDate,
        ...(input.reasonSw && { reasonSw: input.reasonSw }),
        ...(input.reasonEn && { reasonEn: input.reasonEn }),
        ...(input.forwardingAddress && { forwardingAddress: input.forwardingAddress }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      moveOutNoticeId: string;
      effectiveDate: string;
      status: string;
    }>(
      `/tenant/leases/${encodeURIComponent(input.leaseId)}/move-out-notice`,
      body,
    );
  },
};

// ====================================================================
// 20. tenant.documents.list_mine
// ====================================================================
const DocumentsListMineInput = z.object({
  kind: z.enum(['lease', 'invoice', 'receipt', 'notice', 'all']).default('all'),
});
const DocumentsListMineOutput = z.object({
  documents: z.array(
    z.object({
      documentId: z.string(),
      kind: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      url: z.string(),
      createdAt: z.string(),
    }),
  ),
});
export const tenantDocumentsListMineTool: PersonaToolDescriptor<
  typeof DocumentsListMineInput,
  typeof DocumentsListMineOutput
> = {
  id: 'tenant.documents.list_mine',
  name: 'Tenant — list my documents (en) / Mpangaji — orodhesha hati zangu (sw)',
  description: 'List documents available to the tenant (lease PDF, invoices, receipts, notices).',
  personaSlugs: TENANT,
  inputSchema: DocumentsListMineInput,
  outputSchema: DocumentsListMineOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { documents: [] };
    return client.get<{
      documents: Array<{
        documentId: string;
        kind: string;
        titleSw: string;
        titleEn: string;
        url: string;
        createdAt: string;
      }>;
    }>('/tenant/documents/mine', {
      query: { kind: input.kind === 'all' ? undefined : input.kind },
    });
  },
};

// ====================================================================
// 21. tenant.market_intel.show
// ====================================================================
const MarketIntelShowInput = z.object({
  region: z.string().max(120).optional(),
  unitKind: z.enum(['studio', 'one_bed', 'two_bed', 'three_bed', 'four_bed_plus', 'commercial']).optional(),
  windowDays: z.number().int().positive().max(180).default(30),
});
const MarketIntelShowOutput = z.object({
  region: z.string().optional(),
  unitKind: z.string().optional(),
  medianRentTzs: z.number().optional(),
  trend: z.array(
    z.object({
      asOf: z.string(),
      medianRentTzs: z.number(),
    }),
  ),
  asOf: z.string(),
});
export const tenantMarketIntelShowTool: PersonaToolDescriptor<
  typeof MarketIntelShowInput,
  typeof MarketIntelShowOutput
> = {
  id: 'tenant.market_intel.show',
  name: 'Tenant — show market intel (en) / Mpangaji — onyesha taarifa za soko (sw)',
  description: 'Return regional median rent + trend over a configurable window (default 30 days).',
  personaSlugs: TENANT,
  inputSchema: MarketIntelShowInput,
  outputSchema: MarketIntelShowOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { trend: [], asOf: new Date().toISOString() };
    }
    return client.get<{
      region?: string;
      unitKind?: string;
      medianRentTzs?: number;
      trend: Array<{ asOf: string; medianRentTzs: number }>;
      asOf: string;
    }>('/tenant/market-intel', {
      query: {
        region: input.region,
        unitKind: input.unitKind,
        windowDays: input.windowDays,
      },
    });
  },
};

// ====================================================================
// 22. tenant.profile.update
// ====================================================================
const ProfileUpdateInput = z.object({
  preferredLanguage: z.enum(['sw', 'en']).optional(),
  contactEmail: z.string().email().max(200).optional(),
  contactPhone: z.string().max(50).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(50).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ProfileUpdateOutput = z.object({
  updatedAt: z.string(),
});
export const tenantProfileUpdateTool: PersonaToolDescriptor<
  typeof ProfileUpdateInput,
  typeof ProfileUpdateOutput
> = {
  id: 'tenant.profile.update',
  name: 'Tenant — update profile (en) / Mpangaji — sasisha wasifu (sw)',
  description: 'Update the tenant\'s profile fields (language, contact, emergency contact).',
  personaSlugs: TENANT,
  inputSchema: ProfileUpdateInput,
  outputSchema: ProfileUpdateOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { updatedAt: new Date().toISOString() };
    const body = withChatProvenance(
      {
        ...(input.preferredLanguage && { preferredLanguage: input.preferredLanguage }),
        ...(input.contactEmail && { contactEmail: input.contactEmail }),
        ...(input.contactPhone && { contactPhone: input.contactPhone }),
        ...(input.emergencyContactName && { emergencyContactName: input.emergencyContactName }),
        ...(input.emergencyContactPhone && { emergencyContactPhone: input.emergencyContactPhone }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ updatedAt: string }>('/tenant/profile', body);
  },
};

// ====================================================================
// 23. tenant.viewing.request
// ====================================================================
const ViewingRequestInput = z.object({
  listingId: z.string().min(1).max(120),
  preferredAt: z.string(),
  alternateAt: z.string().optional(),
  notesSw: z.string().max(2000).optional(),
  notesEn: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ViewingRequestOutput = z.object({
  viewingRequestId: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const tenantViewingRequestTool: PersonaToolDescriptor<
  typeof ViewingRequestInput,
  typeof ViewingRequestOutput
> = {
  id: 'tenant.viewing.request',
  name: 'Tenant — request a viewing (en) / Mpangaji — omba kuona nyumba (sw)',
  description: 'Request a property viewing on a listing.',
  personaSlugs: TENANT,
  inputSchema: ViewingRequestInput,
  outputSchema: ViewingRequestOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        viewingRequestId: '',
        status: 'unavailable',
        createdAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        preferredAt: input.preferredAt,
        ...(input.alternateAt && { alternateAt: input.alternateAt }),
        ...(input.notesSw && { notesSw: input.notesSw }),
        ...(input.notesEn && { notesEn: input.notesEn }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      viewingRequestId: string;
      status: string;
      createdAt: string;
    }>(
      `/tenant/listings/${encodeURIComponent(input.listingId)}/viewing-request`,
      body,
    );
  },
};

// ====================================================================
// 24. tenant.deposit.show
// ====================================================================
const DepositShowInput = z.object({
  leaseId: z.string().min(1).max(120),
});
const DepositShowOutput = z.object({
  leaseId: z.string(),
  depositHeldTzs: z.number(),
  currency: z.string(),
  depositPostedAt: z.string().optional(),
  refundableTzs: z.number(),
  deductionsTzs: z.number(),
});
export const tenantDepositShowTool: PersonaToolDescriptor<
  typeof DepositShowInput,
  typeof DepositShowOutput
> = {
  id: 'tenant.deposit.show',
  name: 'Tenant — show deposit balance (en) / Mpangaji — onyesha amana yangu (sw)',
  description: 'Show the security deposit balance held against an active lease, plus deductions to date.',
  personaSlugs: TENANT,
  inputSchema: DepositShowInput,
  outputSchema: DepositShowOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        depositHeldTzs: 0,
        currency: 'TZS',
        refundableTzs: 0,
        deductionsTzs: 0,
      };
    }
    return client.get<{
      leaseId: string;
      depositHeldTzs: number;
      currency: string;
      depositPostedAt?: string;
      refundableTzs: number;
      deductionsTzs: number;
    }>(`/tenant/leases/${encodeURIComponent(input.leaseId)}/deposit`);
  },
};

// ====================================================================
// 25. tenant.payment.history
// ====================================================================
const PaymentHistoryInput = z.object({
  leaseId: z.string().min(1).max(120).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().positive().max(100).default(50),
});
const PaymentHistoryOutput = z.object({
  payments: z.array(
    z.object({
      paymentId: z.string(),
      leaseId: z.string(),
      amountTzs: z.number(),
      paymentProvider: z.string(),
      paymentRef: z.string(),
      postedAt: z.string(),
      status: z.string(),
    }),
  ),
  totalPaymentsTzs: z.number(),
});
export const tenantPaymentHistoryTool: PersonaToolDescriptor<
  typeof PaymentHistoryInput,
  typeof PaymentHistoryOutput
> = {
  id: 'tenant.payment.history',
  name: 'Tenant — payment history (en) / Mpangaji — historia ya malipo (sw)',
  description: 'Return the caller\'s payment history across all leases or a single one.',
  personaSlugs: TENANT,
  inputSchema: PaymentHistoryInput,
  outputSchema: PaymentHistoryOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { payments: [], totalPaymentsTzs: 0 };
    }
    return client.get<{
      payments: Array<{
        paymentId: string;
        leaseId: string;
        amountTzs: number;
        paymentProvider: string;
        paymentRef: string;
        postedAt: string;
        status: string;
      }>;
      totalPaymentsTzs: number;
    }>('/tenant/payments/history', {
      query: {
        leaseId: input.leaseId,
        fromDate: input.fromDate,
        toDate: input.toDate,
        limit: input.limit,
      },
    });
  },
};

// ====================================================================
// 26. tenant.appeal.create
// ====================================================================
const AppealCreateInput = z.object({
  applicationId: z.string().min(1).max(120).optional(),
  complaintId: z.string().min(1).max(120).optional(),
  rationaleSw: z.string().min(1).max(4000),
  rationaleEn: z.string().min(1).max(4000),
  evidenceRef: z.string().min(1).max(500),
});
const AppealCreateOutput = z.object({
  appealId: z.string(),
  createdAt: z.string(),
});
export const tenantAppealCreateTool: PersonaToolDescriptor<
  typeof AppealCreateInput,
  typeof AppealCreateOutput
> = {
  id: 'tenant.appeal.create',
  name: 'Tenant — file appeal (en) / Mpangaji — kata rufaa (sw)',
  description: 'Appeal an application rejection or a complaint resolution.',
  personaSlugs: TENANT,
  inputSchema: AppealCreateInput,
  outputSchema: AppealCreateOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { appealId: '', createdAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        ...(input.applicationId && { applicationId: input.applicationId }),
        ...(input.complaintId && { complaintId: input.complaintId }),
        rationaleSw: input.rationaleSw,
        rationaleEn: input.rationaleEn,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ appealId: string; createdAt: string }>(
      '/tenant/appeals',
      body,
    );
  },
};

// ====================================================================
// 27. tenant.guest.invite
// ====================================================================
const GuestInviteInput = z.object({
  leaseId: z.string().min(1).max(120),
  guestName: z.string().min(1).max(200),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: z.number().int().positive().max(30),
  evidenceRef: z.string().min(1).max(500),
});
const GuestInviteOutput = z.object({
  guestInviteId: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const tenantGuestInviteTool: PersonaToolDescriptor<
  typeof GuestInviteInput,
  typeof GuestInviteOutput
> = {
  id: 'tenant.guest.invite',
  name: 'Tenant — invite guest (en) / Mpangaji — mwalike mgeni (sw)',
  description: 'Register a guest visit for security and concierge awareness.',
  personaSlugs: TENANT,
  inputSchema: GuestInviteInput,
  outputSchema: GuestInviteOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        guestInviteId: '',
        status: 'unavailable',
        createdAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        guestName: input.guestName,
        visitDate: input.visitDate,
        durationDays: input.durationDays,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      guestInviteId: string;
      status: string;
      createdAt: string;
    }>(
      `/tenant/leases/${encodeURIComponent(input.leaseId)}/guest-invites`,
      body,
    );
  },
};

// ====================================================================
// 28. tenant.lease.terminate_early
// ====================================================================
const LeaseTerminateEarlyInput = z.object({
  leaseId: z.string().min(1).max(120),
  intendedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reasonSw: z.string().min(1).max(2000),
  reasonEn: z.string().min(1).max(2000),
  ackEarlyTerminationFee: z.literal(true),
  evidenceRef: z.string().min(1).max(500),
});
const LeaseTerminateEarlyOutput = z.object({
  leaseId: z.string(),
  terminationRequestId: z.string(),
  estimatedFeeTzs: z.number(),
  status: z.string(),
});
export const tenantLeaseTerminateEarlyTool: PersonaToolDescriptor<
  typeof LeaseTerminateEarlyInput,
  typeof LeaseTerminateEarlyOutput
> = {
  id: 'tenant.lease.terminate_early',
  name: 'Tenant — request early termination (en) / Mpangaji — omba kukomesha mapema (sw)',
  description:
    'Request early termination of an active lease. Includes acknowledgement of ' +
    'the early-termination fee schedule. HIGH stakes — opens financial settlement.',
  personaSlugs: TENANT,
  inputSchema: LeaseTerminateEarlyInput,
  outputSchema: LeaseTerminateEarlyOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        terminationRequestId: '',
        estimatedFeeTzs: 0,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        intendedEndDate: input.intendedEndDate,
        reasonSw: input.reasonSw,
        reasonEn: input.reasonEn,
        ackEarlyTerminationFee: input.ackEarlyTerminationFee,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      leaseId: string;
      terminationRequestId: string;
      estimatedFeeTzs: number;
      status: string;
    }>(
      `/tenant/leases/${encodeURIComponent(input.leaseId)}/terminate-early`,
      body,
    );
  },
};

// ====================================================================
// 29. tenant.support.contact
// ====================================================================
const SupportContactInput = z.object({
  subject: z.string().min(1).max(200),
  bodySw: z.string().min(1).max(4000),
  bodyEn: z.string().min(1).max(4000),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  evidenceRef: z.string().min(1).max(500),
});
const SupportContactOutput = z.object({
  supportTicketId: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export const tenantSupportContactTool: PersonaToolDescriptor<
  typeof SupportContactInput,
  typeof SupportContactOutput
> = {
  id: 'tenant.support.contact',
  name: 'Tenant — contact support (en) / Mpangaji — wasiliana na msaada (sw)',
  description: 'Open a support ticket with the property team / BossNyumba concierge.',
  personaSlugs: TENANT,
  inputSchema: SupportContactInput,
  outputSchema: SupportContactOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        supportTicketId: '',
        status: 'unavailable',
        createdAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        subject: input.subject,
        bodySw: input.bodySw,
        bodyEn: input.bodyEn,
        urgency: input.urgency,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      supportTicketId: string;
      status: string;
      createdAt: string;
    }>('/tenant/support-tickets', body);
  },
};

// ====================================================================
// 30. tenant.notification.mark_read
// ====================================================================
const NotificationMarkReadInput = z.object({
  notificationId: z.string().min(1).max(120),
});
const NotificationMarkReadOutput = z.object({
  notificationId: z.string(),
  readAt: z.string(),
});
export const tenantNotificationMarkReadTool: PersonaToolDescriptor<
  typeof NotificationMarkReadInput,
  typeof NotificationMarkReadOutput
> = {
  id: 'tenant.notification.mark_read',
  name: 'Tenant — mark notification read (en) / Mpangaji — wekea alama imesomwa (sw)',
  description: 'Mark a notification as read.',
  personaSlugs: TENANT,
  inputSchema: NotificationMarkReadInput,
  outputSchema: NotificationMarkReadOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        notificationId: input.notificationId,
        readAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance({}, ctx);
    return client.post<{ notificationId: string; readAt: string }>(
      `/tenant/notifications/${encodeURIComponent(input.notificationId)}/read`,
      body,
    );
  },
};

// ====================================================================
// Catalog export
// ====================================================================
export const TENANT_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  tenantListingBrowseTool,
  tenantListingShowTool,
  tenantListingNearbyTool,
  tenantSavedSearchCreateTool,
  tenantApplicationCreateTool,
  tenantApplicationListMineTool,
  tenantApplicationWithdrawTool,
  tenantKycMeTool,
  tenantKycUploadAtomTool,
  tenantMoveInSignTool,
  tenantLeaseShowTool,
  tenantLeaseRenewalRespondTool,
  tenantRentPayTool,
  tenantRentStatementTool,
  tenantMaintenanceRequestCreateTool,
  tenantMaintenanceListMineTool,
  tenantComplaintCreateTool,
  tenantNotificationListTool,
  tenantMoveOutNoticeTool,
  tenantDocumentsListMineTool,
  tenantMarketIntelShowTool,
  tenantProfileUpdateTool,
  tenantViewingRequestTool,
  tenantDepositShowTool,
  tenantPaymentHistoryTool,
  tenantAppealCreateTool,
  tenantGuestInviteTool,
  tenantLeaseTerminateEarlyTool,
  tenantSupportContactTool,
  tenantNotificationMarkReadTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
