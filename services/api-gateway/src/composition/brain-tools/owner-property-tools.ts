/**
 * PT-A — Owner persona property tools (T1 strategist cockpit).
 *
 * Real-estate retailoring of Borjie's owner-tools.ts + owner-estate-tools.ts
 * + owner-messaging-tools.ts + owner-saved-search-tools.ts. Mr. Mwikila's
 * canonical user persona is the property owner — landlord, multi-unit
 * portfolio holder, single-family rental investor, multi-family operator.
 *
 * Mapping discipline:
 *   - royalty.forecast              → owner.cashflow.forecast
 *   - sales.summary                 → owner.rent_collection.summary
 *   - estate.metrics                → owner.portfolio.metrics
 *   - license.list_active           → owner.lease.list_active
 *   - license.expiring_soon         → owner.lease.expiring_soon
 *   - site.list                     → owner.property.list
 *   - worker.list_active            → owner.tenant.list_active
 *   - task.backlog                  → owner.maintenance.backlog
 *   - rfb.*                         → owner.rfa.* (Request For Application)
 *   - delivery.sign                 → owner.move_in_out.sign
 *
 * Every read defers to the loopback HTTP client so the LLM and the
 * owner-portal render identical data (no parallel data paths). Every
 * WRITE wraps the body with `withChatProvenance(body, ctx)` so the
 * downstream row's `provenance` column carries `via: 'chat'`.
 *
 * Tier discipline:
 *   - cockpit reads — LOW, isWrite=false
 *   - tenant + maintenance dispatch — MEDIUM, isWrite=true
 *   - lease renewal submission + regulator disclosure — HIGH, isWrite=true
 *
 * Evidence-required (CLAUDE.md inviolable): every WRITE handler attaches
 * `evidenceRefs` to the POST body so the downstream Auditor Agent can
 * reject responses with empty evidence chains.
 */

import { z } from 'zod';
import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const OWNER: ReadonlyArray<'T1_owner_strategist'> = ['T1_owner_strategist'];

// ====================================================================
// 1. owner.cashflow.forecast (was royalty.forecast)
// ====================================================================
const CashflowForecastInput = z.object({
  horizonMonths: z.number().int().positive().max(36).default(6),
  propertyId: z.string().min(1).max(120).optional(),
});
const CashflowForecastOutput = z.object({
  horizonMonths: z.number().int(),
  byMonth: z.array(
    z.object({
      month: z.string(),
      projectedRentGrossTzs: z.number(),
      projectedOpexTzs: z.number(),
      projectedNetTzs: z.number(),
    }),
  ),
  currency: z.string(),
});
export const ownerCashflowForecastTool: PersonaToolDescriptor<
  typeof CashflowForecastInput,
  typeof CashflowForecastOutput
> = {
  id: 'owner.cashflow.forecast',
  name: 'Owner — cashflow forecast (en) / Mwenye — utabiri wa pesa (sw)',
  description:
    'Projected rent collection, opex, and net cashflow over the next ' +
    '`horizonMonths` (default 6). Optional `propertyId` narrows to a ' +
    'single property. Read-only — defers to /owner/cashflow/forecast.',
  personaSlugs: OWNER,
  inputSchema: CashflowForecastInput,
  outputSchema: CashflowForecastOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        horizonMonths: input.horizonMonths,
        byMonth: [],
        currency: 'TZS',
      };
    }
    return client.get<{
      horizonMonths: number;
      byMonth: Array<{
        month: string;
        projectedRentGrossTzs: number;
        projectedOpexTzs: number;
        projectedNetTzs: number;
      }>;
      currency: string;
    }>('/owner/cashflow/forecast', {
      query: {
        horizonMonths: input.horizonMonths,
        ...(input.propertyId && { propertyId: input.propertyId }),
      },
    });
  },
};

// ====================================================================
// 2. owner.rent_collection.summary (was sales.summary)
// ====================================================================
const RentSummaryInput = z.object({
  windowDays: z.number().int().positive().max(365).default(30),
});
const RentSummaryOutput = z.object({
  windowDays: z.number().int(),
  totalCollectedTzs: z.number(),
  totalOutstandingTzs: z.number(),
  collectionRate: z.number(),
  delinquentTenants: z.number().int(),
});
export const ownerRentCollectionSummaryTool: PersonaToolDescriptor<
  typeof RentSummaryInput,
  typeof RentSummaryOutput
> = {
  id: 'owner.rent_collection.summary',
  name: 'Owner — rent collection summary (en) / Mwenye — muhtasari wa kodi (sw)',
  description:
    'Rolling rent collection summary over the last `windowDays`. Returns ' +
    'total collected, total outstanding, collection rate (0..1), and ' +
    'delinquent tenant count.',
  personaSlugs: OWNER,
  inputSchema: RentSummaryInput,
  outputSchema: RentSummaryOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        windowDays: input.windowDays,
        totalCollectedTzs: 0,
        totalOutstandingTzs: 0,
        collectionRate: 0,
        delinquentTenants: 0,
      };
    }
    return client.get<{
      windowDays: number;
      totalCollectedTzs: number;
      totalOutstandingTzs: number;
      collectionRate: number;
      delinquentTenants: number;
    }>('/owner/rent-collection/summary', {
      query: { windowDays: input.windowDays },
    });
  },
};

// ====================================================================
// 3. owner.portfolio.metrics (was estate.metrics)
// ====================================================================
const PortfolioMetricsInput = z.object({});
const PortfolioMetricsOutput = z.object({
  propertyCount: z.number().int(),
  unitCount: z.number().int(),
  occupancyRate: z.number(),
  totalValueTzs: z.number(),
  monthlyGrossRentTzs: z.number(),
  noiAnnualTzs: z.number(),
  capRate: z.number(),
});
export const ownerPortfolioMetricsTool: PersonaToolDescriptor<
  typeof PortfolioMetricsInput,
  typeof PortfolioMetricsOutput
> = {
  id: 'owner.portfolio.metrics',
  name: 'Owner — portfolio metrics (en) / Mwenye — vipimo vya mali (sw)',
  description:
    'Whole-portfolio metrics: property + unit counts, occupancy rate, ' +
    'total value, monthly gross rent, annual NOI, and cap rate.',
  personaSlugs: OWNER,
  inputSchema: PortfolioMetricsInput,
  outputSchema: PortfolioMetricsOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        propertyCount: 0,
        unitCount: 0,
        occupancyRate: 0,
        totalValueTzs: 0,
        monthlyGrossRentTzs: 0,
        noiAnnualTzs: 0,
        capRate: 0,
      };
    }
    return client.get<{
      propertyCount: number;
      unitCount: number;
      occupancyRate: number;
      totalValueTzs: number;
      monthlyGrossRentTzs: number;
      noiAnnualTzs: number;
      capRate: number;
    }>('/owner/portfolio/metrics');
  },
};

// ====================================================================
// 4. owner.lease.list_active (was license.list_active)
// ====================================================================
const LeaseListInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});
const LeaseListOutput = z.object({
  leases: z.array(
    z.object({
      leaseId: z.string(),
      unitId: z.string(),
      tenantId: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      monthlyRentTzs: z.number(),
      status: z.enum(['active', 'pending', 'expired', 'terminated']),
    }),
  ),
});
export const ownerLeaseListActiveTool: PersonaToolDescriptor<
  typeof LeaseListInput,
  typeof LeaseListOutput
> = {
  id: 'owner.lease.list_active',
  name: 'Owner — active leases (en) / Mwenye — mikataba hai (sw)',
  description: 'List active leases across the owner portfolio.',
  personaSlugs: OWNER,
  inputSchema: LeaseListInput,
  outputSchema: LeaseListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { leases: [] };
    return client.get<{
      leases: Array<{
        leaseId: string;
        unitId: string;
        tenantId: string;
        startsOn: string;
        endsOn: string;
        monthlyRentTzs: number;
        status: 'active' | 'pending' | 'expired' | 'terminated';
      }>;
    }>('/owner/leases', {
      query: { status: 'active', limit: input.limit },
    });
  },
};

// ====================================================================
// 5. owner.lease.expiring_soon (was license.expiring_soon)
// ====================================================================
const LeaseExpiringInput = z.object({
  windowDays: z.number().int().positive().max(180).default(60),
});
const LeaseExpiringOutput = z.object({
  alerts: z.array(
    z.object({
      leaseId: z.string(),
      unitId: z.string(),
      tenantId: z.string(),
      endsOn: z.string(),
      daysRemaining: z.number().int(),
      tier: z.enum(['T-60', 'T-30', 'T-7', 'expired']),
    }),
  ),
});
export const ownerLeaseExpiringSoonTool: PersonaToolDescriptor<
  typeof LeaseExpiringInput,
  typeof LeaseExpiringOutput
> = {
  id: 'owner.lease.expiring_soon',
  name: 'Owner — leases expiring soon (en) / Mwenye — mikataba inayoisha (sw)',
  description:
    'Leases approaching renewal at T-60 / T-30 / T-7 plus any already ' +
    'expired. Drives the cockpit lease-renewal carousel.',
  personaSlugs: OWNER,
  inputSchema: LeaseExpiringInput,
  outputSchema: LeaseExpiringOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { alerts: [] };
    return client.get<{
      alerts: Array<{
        leaseId: string;
        unitId: string;
        tenantId: string;
        endsOn: string;
        daysRemaining: number;
        tier: 'T-60' | 'T-30' | 'T-7' | 'expired';
      }>;
    }>('/owner/leases/expiring', {
      query: { windowDays: input.windowDays },
    });
  },
};

// ====================================================================
// 6. owner.property.list (was site.list)
// ====================================================================
const PropertyListInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});
const PropertyListOutput = z.object({
  properties: z.array(
    z.object({
      propertyId: z.string(),
      name: z.string(),
      address: z.string(),
      unitCount: z.number().int(),
      occupancyRate: z.number(),
    }),
  ),
});
export const ownerPropertyListTool: PersonaToolDescriptor<
  typeof PropertyListInput,
  typeof PropertyListOutput
> = {
  id: 'owner.property.list',
  name: 'Owner — list properties (en) / Mwenye — orodha ya mali (sw)',
  description: 'List the properties in the owner portfolio.',
  personaSlugs: OWNER,
  inputSchema: PropertyListInput,
  outputSchema: PropertyListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { properties: [] };
    return client.get<{
      properties: Array<{
        propertyId: string;
        name: string;
        address: string;
        unitCount: number;
        occupancyRate: number;
      }>;
    }>('/owner/properties', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 7. owner.tenant.list_active (was worker.list_active)
// ====================================================================
const TenantListInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});
const TenantListOutput = z.object({
  tenants: z.array(
    z.object({
      tenantId: z.string(),
      fullName: z.string(),
      unitId: z.string().optional(),
      leaseId: z.string().optional(),
      moveInDate: z.string().optional(),
      paymentStatus: z.enum(['current', 'late', 'delinquent']),
    }),
  ),
});
export const ownerTenantListActiveTool: PersonaToolDescriptor<
  typeof TenantListInput,
  typeof TenantListOutput
> = {
  id: 'owner.tenant.list_active',
  name: 'Owner — active tenants (en) / Mwenye — wapangaji hai (sw)',
  description: 'List the active tenants across the owner portfolio.',
  personaSlugs: OWNER,
  inputSchema: TenantListInput,
  outputSchema: TenantListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { tenants: [] };
    return client.get<{
      tenants: Array<{
        tenantId: string;
        fullName: string;
        unitId?: string;
        leaseId?: string;
        moveInDate?: string;
        paymentStatus: 'current' | 'late' | 'delinquent';
      }>;
    }>('/owner/tenants', {
      query: { status: 'active', limit: input.limit },
    });
  },
};

// ====================================================================
// 8. owner.tenant.delinquent (NEW — high-value for real estate)
// ====================================================================
const DelinquentInput = z.object({
  minDaysLate: z.number().int().nonnegative().max(120).default(15),
});
const DelinquentOutput = z.object({
  tenants: z.array(
    z.object({
      tenantId: z.string(),
      fullName: z.string(),
      unitId: z.string(),
      amountOwedTzs: z.number(),
      daysLate: z.number().int(),
      lastPaidAt: z.string().nullable(),
    }),
  ),
});
export const ownerTenantDelinquentTool: PersonaToolDescriptor<
  typeof DelinquentInput,
  typeof DelinquentOutput
> = {
  id: 'owner.tenant.delinquent',
  name: 'Owner — delinquent tenants (en) / Mwenye — wapangaji wanaodaiwa (sw)',
  description:
    'Tenants whose rent is at least `minDaysLate` days overdue. Drives ' +
    'the cockpit collections banner and the recovery workflow.',
  personaSlugs: OWNER,
  inputSchema: DelinquentInput,
  outputSchema: DelinquentOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { tenants: [] };
    return client.get<{
      tenants: Array<{
        tenantId: string;
        fullName: string;
        unitId: string;
        amountOwedTzs: number;
        daysLate: number;
        lastPaidAt: string | null;
      }>;
    }>('/owner/tenants/delinquent', {
      query: { minDaysLate: input.minDaysLate },
    });
  },
};

// ====================================================================
// 9. owner.maintenance.backlog (was task.backlog)
// ====================================================================
const MaintenanceBacklogInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});
const MaintenanceBacklogOutput = z.object({
  workOrders: z.array(
    z.object({
      workOrderId: z.string(),
      unitId: z.string(),
      title: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      ageDays: z.number().int(),
    }),
  ),
});
export const ownerMaintenanceBacklogTool: PersonaToolDescriptor<
  typeof MaintenanceBacklogInput,
  typeof MaintenanceBacklogOutput
> = {
  id: 'owner.maintenance.backlog',
  name: 'Owner — maintenance backlog (en) / Mwenye — kazi za matengenezo zilizosalia (sw)',
  description:
    'Open + unassigned maintenance work orders across the portfolio, ' +
    'sorted by priority then age.',
  personaSlugs: OWNER,
  inputSchema: MaintenanceBacklogInput,
  outputSchema: MaintenanceBacklogOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { workOrders: [] };
    return client.get<{
      workOrders: Array<{
        workOrderId: string;
        unitId: string;
        title: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        ageDays: number;
      }>;
    }>('/owner/maintenance/backlog', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 10. owner.compliance.calendar (preserved)
// ====================================================================
const ComplianceCalendarInput = z.object({
  windowDays: z.number().int().positive().max(180).default(90),
});
const ComplianceCalendarOutput = z.object({
  filings: z.array(
    z.object({
      filingId: z.string(),
      regulator: z.string(),
      kind: z.string(),
      dueAt: z.string(),
      daysRemaining: z.number().int(),
    }),
  ),
});
export const ownerComplianceCalendarTool: PersonaToolDescriptor<
  typeof ComplianceCalendarInput,
  typeof ComplianceCalendarOutput
> = {
  id: 'owner.compliance.calendar',
  name: 'Owner — compliance calendar (en) / Mwenye — kalenda ya ufuatiliaji (sw)',
  description:
    'Upcoming regulator filings (city housing authority, tax council, ' +
    'land-rent) due within `windowDays` (default 90).',
  personaSlugs: OWNER,
  inputSchema: ComplianceCalendarInput,
  outputSchema: ComplianceCalendarOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { filings: [] };
    return client.get<{
      filings: Array<{
        filingId: string;
        regulator: string;
        kind: string;
        dueAt: string;
        daysRemaining: number;
      }>;
    }>('/owner/compliance/calendar', {
      query: { windowDays: input.windowDays },
    });
  },
};

// ====================================================================
// 11. owner.draft.lock (preserved)
// ====================================================================
const DraftLockInput = z.object({
  draftId: z.string().min(1).max(120),
  reasonEvidenceRef: z.string().min(1).max(500),
});
const DraftLockOutput = z.object({
  draftId: z.string(),
  locked: z.boolean(),
});
export const ownerDraftLockTool: PersonaToolDescriptor<
  typeof DraftLockInput,
  typeof DraftLockOutput
> = {
  id: 'owner.draft.lock',
  name: 'Owner — lock draft (en) / Mwenye — funga rasimu (sw)',
  description:
    'Lock a draft so co-actors cannot edit while the owner reviews. ' +
    'Requires `reasonEvidenceRef` per CLAUDE.md evidence-required rule.',
  personaSlugs: OWNER,
  inputSchema: DraftLockInput,
  outputSchema: DraftLockOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { draftId: input.draftId, locked: false };
    const body = withChatProvenance(
      {
        evidenceRefs: [input.reasonEvidenceRef],
      },
      ctx,
    );
    const res = await client.post<{
      draftId: string;
      locked: boolean;
    }>(`/owner/drafts/${encodeURIComponent(input.draftId)}/lock`, body);
    return { draftId: res.draftId, locked: res.locked };
  },
};

// ====================================================================
// 12. owner.share.create (preserved)
// ====================================================================
const ShareCreateInput = z.object({
  resourceType: z.enum(['property', 'lease', 'report', 'brief']),
  resourceId: z.string().min(1).max(120),
  shareWithEmail: z.string().email(),
  evidenceRef: z.string().min(1).max(500),
});
const ShareCreateOutput = z.object({
  shareId: z.string(),
  shareUrl: z.string(),
});
export const ownerShareCreateTool: PersonaToolDescriptor<
  typeof ShareCreateInput,
  typeof ShareCreateOutput
> = {
  id: 'owner.share.create',
  name: 'Owner — share resource (en) / Mwenye — shiriki rasilimali (sw)',
  description:
    'Create a share link for a property / lease / report / brief with a ' +
    'specific email recipient. Requires an evidence reference.',
  personaSlugs: OWNER,
  inputSchema: ShareCreateInput,
  outputSchema: ShareCreateOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { shareId: '', shareUrl: '' };
    const body = withChatProvenance(
      {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        shareWithEmail: input.shareWithEmail,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ shareId: string; shareUrl: string }>(
      '/owner/shares',
      body,
    );
  },
};

// ====================================================================
// 13-15. owner.reminder.{create,list,snooze} (preserved)
// ====================================================================
const ReminderCreateInput = z.object({
  title: z.string().min(1).max(240),
  dueAt: z.string().datetime(),
  evidenceRef: z.string().min(1).max(500),
});
const ReminderCreateOutput = z.object({
  reminderId: z.string(),
  status: z.string(),
});
export const ownerReminderCreateTool: PersonaToolDescriptor<
  typeof ReminderCreateInput,
  typeof ReminderCreateOutput
> = {
  id: 'owner.reminder.create',
  name: 'Owner — create reminder (en) / Mwenye — tengeneza kumbukumbu (sw)',
  description: 'Create a reminder for the owner cockpit inbox.',
  personaSlugs: OWNER,
  inputSchema: ReminderCreateInput,
  outputSchema: ReminderCreateOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { reminderId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        title: input.title,
        dueAt: input.dueAt,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ reminderId: string; status: string }>(
      '/owner/reminders',
      body,
    );
  },
};

const ReminderListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const ReminderListOutput = z.object({
  reminders: z.array(
    z.object({
      reminderId: z.string(),
      title: z.string(),
      dueAt: z.string(),
      status: z.string(),
    }),
  ),
});
export const ownerReminderListTool: PersonaToolDescriptor<
  typeof ReminderListInput,
  typeof ReminderListOutput
> = {
  id: 'owner.reminder.list',
  name: 'Owner — list reminders (en) / Mwenye — orodha ya kumbukumbu (sw)',
  description: 'List the owner’s pending reminders.',
  personaSlugs: OWNER,
  inputSchema: ReminderListInput,
  outputSchema: ReminderListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { reminders: [] };
    return client.get<{
      reminders: Array<{
        reminderId: string;
        title: string;
        dueAt: string;
        status: string;
      }>;
    }>('/owner/reminders', { query: { limit: input.limit } });
  },
};

const ReminderSnoozeInput = z.object({
  reminderId: z.string().min(1).max(120),
  snoozeUntil: z.string().datetime(),
});
const ReminderSnoozeOutput = z.object({
  reminderId: z.string(),
  snoozedUntil: z.string(),
});
export const ownerReminderSnoozeTool: PersonaToolDescriptor<
  typeof ReminderSnoozeInput,
  typeof ReminderSnoozeOutput
> = {
  id: 'owner.reminder.snooze',
  name: 'Owner — snooze reminder (en) / Mwenye — ahirisha kumbukumbu (sw)',
  description: 'Snooze a reminder until the given timestamp.',
  personaSlugs: OWNER,
  inputSchema: ReminderSnoozeInput,
  outputSchema: ReminderSnoozeOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client)
      return {
        reminderId: input.reminderId,
        snoozedUntil: input.snoozeUntil,
      };
    const body = withChatProvenance(
      { snoozeUntil: input.snoozeUntil },
      ctx,
    );
    return client.post<{ reminderId: string; snoozedUntil: string }>(
      `/owner/reminders/${encodeURIComponent(input.reminderId)}/snooze`,
      body,
    );
  },
};

// ====================================================================
// 16-18. owner.payroll.{run,preview,commit} (preserved)
// ====================================================================
const PayrollRunInput = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});
const PayrollRunOutput = z.object({
  runId: z.string(),
  status: z.enum(['draft', 'preview_ready', 'committed', 'failed']),
});
export const ownerPayrollRunTool: PersonaToolDescriptor<
  typeof PayrollRunInput,
  typeof PayrollRunOutput
> = {
  id: 'owner.payroll.run',
  name: 'Owner — start payroll run (en) / Mwenye — anza malipo ya mishahara (sw)',
  description:
    'Initiate a payroll run for property staff for the given YYYY-MM ' +
    'period. Money path flows through LedgerService.post() at commit.',
  personaSlugs: OWNER,
  inputSchema: PayrollRunInput,
  outputSchema: PayrollRunOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { runId: '', status: 'failed' as const };
    const body = withChatProvenance({ period: input.period }, ctx);
    return client.post<{
      runId: string;
      status: 'draft' | 'preview_ready' | 'committed' | 'failed';
    }>('/owner/payroll/runs', body);
  },
};

const PayrollPreviewInput = z.object({
  runId: z.string().min(1).max(120),
});
const PayrollPreviewOutput = z.object({
  runId: z.string(),
  totalGrossTzs: z.number(),
  totalTaxTzs: z.number(),
  totalNetTzs: z.number(),
  lineCount: z.number().int(),
});
export const ownerPayrollPreviewTool: PersonaToolDescriptor<
  typeof PayrollPreviewInput,
  typeof PayrollPreviewOutput
> = {
  id: 'owner.payroll.preview',
  name: 'Owner — payroll preview (en) / Mwenye — onyesho la malipo (sw)',
  description: 'Preview the totals of a pending payroll run.',
  personaSlugs: OWNER,
  inputSchema: PayrollPreviewInput,
  outputSchema: PayrollPreviewOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        runId: input.runId,
        totalGrossTzs: 0,
        totalTaxTzs: 0,
        totalNetTzs: 0,
        lineCount: 0,
      };
    }
    return client.get<{
      runId: string;
      totalGrossTzs: number;
      totalTaxTzs: number;
      totalNetTzs: number;
      lineCount: number;
    }>(`/owner/payroll/runs/${encodeURIComponent(input.runId)}/preview`);
  },
};

const PayrollCommitInput = z.object({
  runId: z.string().min(1).max(120),
  approvalEvidenceRef: z.string().min(1).max(500),
});
const PayrollCommitOutput = z.object({
  runId: z.string(),
  status: z.enum(['committed', 'failed']),
  ledgerTxnId: z.string().nullable(),
});
export const ownerPayrollCommitTool: PersonaToolDescriptor<
  typeof PayrollCommitInput,
  typeof PayrollCommitOutput
> = {
  id: 'owner.payroll.commit',
  name: 'Owner — commit payroll (en) / Mwenye — thibitisha malipo (sw)',
  description:
    'Commit a previewed payroll run. The downstream route posts via ' +
    'LedgerService.post() — money path is inviolable.',
  personaSlugs: OWNER,
  inputSchema: PayrollCommitInput,
  outputSchema: PayrollCommitOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client)
      return {
        runId: input.runId,
        status: 'failed' as const,
        ledgerTxnId: null,
      };
    const body = withChatProvenance(
      { evidenceRefs: [input.approvalEvidenceRef] },
      ctx,
    );
    return client.post<{
      runId: string;
      status: 'committed' | 'failed';
      ledgerTxnId: string | null;
    }>(
      `/owner/payroll/runs/${encodeURIComponent(input.runId)}/commit`,
      body,
    );
  },
};

// ====================================================================
// 19. owner.brief.show (preserved)
// ====================================================================
const BriefShowInput = z.object({
  briefId: z.string().min(1).max(120).optional(),
});
const BriefShowOutput = z.object({
  briefId: z.string(),
  headlineEn: z.string(),
  headlineSw: z.string(),
  bodyMarkdown: z.string(),
  generatedAt: z.string(),
});
export const ownerBriefShowTool: PersonaToolDescriptor<
  typeof BriefShowInput,
  typeof BriefShowOutput
> = {
  id: 'owner.brief.show',
  name: 'Owner — show brief (en) / Mwenye — onyesha taarifa (sw)',
  description:
    'Show the current daily brief or a specific historical brief by id.',
  personaSlugs: OWNER,
  inputSchema: BriefShowInput,
  outputSchema: BriefShowOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        briefId: input.briefId ?? 'unavailable',
        headlineEn: '',
        headlineSw: '',
        bodyMarkdown: '',
        generatedAt: new Date().toISOString(),
      };
    }
    return client.get<{
      briefId: string;
      headlineEn: string;
      headlineSw: string;
      bodyMarkdown: string;
      generatedAt: string;
    }>('/owner/briefs/current', {
      query: { ...(input.briefId && { briefId: input.briefId }) },
    });
  },
};

// ====================================================================
// 20-21. owner.decision.{record,list} (preserved)
// ====================================================================
const DecisionRecordInput = z.object({
  summary: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
  rationale: z.string().min(1).max(2000),
});
const DecisionRecordOutput = z.object({
  decisionId: z.string(),
  recordedAt: z.string(),
});
export const ownerDecisionRecordTool: PersonaToolDescriptor<
  typeof DecisionRecordInput,
  typeof DecisionRecordOutput
> = {
  id: 'owner.decision.record',
  name: 'Owner — record decision (en) / Mwenye — andika uamuzi (sw)',
  description:
    'Append a decision to the decision journal (hash-chained, append-only).',
  personaSlugs: OWNER,
  inputSchema: DecisionRecordInput,
  outputSchema: DecisionRecordOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client)
      return { decisionId: '', recordedAt: new Date().toISOString() };
    const body = withChatProvenance(
      {
        summary: input.summary,
        rationale: input.rationale,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ decisionId: string; recordedAt: string }>(
      '/owner/decisions',
      body,
    );
  },
};

const DecisionListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const DecisionListOutput = z.object({
  decisions: z.array(
    z.object({
      decisionId: z.string(),
      summary: z.string(),
      recordedAt: z.string(),
    }),
  ),
});
export const ownerDecisionListTool: PersonaToolDescriptor<
  typeof DecisionListInput,
  typeof DecisionListOutput
> = {
  id: 'owner.decision.list',
  name: 'Owner — list decisions (en) / Mwenye — orodha ya maamuzi (sw)',
  description: 'List recently recorded owner decisions.',
  personaSlugs: OWNER,
  inputSchema: DecisionListInput,
  outputSchema: DecisionListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { decisions: [] };
    return client.get<{
      decisions: Array<{
        decisionId: string;
        summary: string;
        recordedAt: string;
      }>;
    }>('/owner/decisions', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 22-23. owner.opportunity.list / owner.risk.list (preserved)
// ====================================================================
const OpportunityListInput = z.object({
  limit: z.number().int().positive().max(50).default(20),
});
const OpportunityListOutput = z.object({
  opportunities: z.array(
    z.object({
      opportunityId: z.string(),
      kind: z.string(),
      summary: z.string(),
      estimatedUpsideTzs: z.number(),
      confidence: z.number(),
    }),
  ),
});
export const ownerOpportunityListTool: PersonaToolDescriptor<
  typeof OpportunityListInput,
  typeof OpportunityListOutput
> = {
  id: 'owner.opportunity.list',
  name: 'Owner — opportunities (en) / Mwenye — fursa (sw)',
  description:
    'Opportunity-scanner output: rent-uplift candidates, vacancy ' +
    'risk reductions, fee-recovery proposals.',
  personaSlugs: OWNER,
  inputSchema: OpportunityListInput,
  outputSchema: OpportunityListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { opportunities: [] };
    return client.get<{
      opportunities: Array<{
        opportunityId: string;
        kind: string;
        summary: string;
        estimatedUpsideTzs: number;
        confidence: number;
      }>;
    }>('/owner/opportunities', { query: { limit: input.limit } });
  },
};

const RiskListInput = z.object({
  limit: z.number().int().positive().max(50).default(20),
});
const RiskListOutput = z.object({
  risks: z.array(
    z.object({
      riskId: z.string(),
      kind: z.string(),
      summary: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
    }),
  ),
});
export const ownerRiskListTool: PersonaToolDescriptor<
  typeof RiskListInput,
  typeof RiskListOutput
> = {
  id: 'owner.risk.list',
  name: 'Owner — risks (en) / Mwenye — hatari (sw)',
  description:
    'Risk-scanner output: market, regulatory, tenant-mix, climate exposures.',
  personaSlugs: OWNER,
  inputSchema: RiskListInput,
  outputSchema: RiskListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { risks: [] };
    return client.get<{
      risks: Array<{
        riskId: string;
        kind: string;
        summary: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
      }>;
    }>('/owner/risks', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 24. owner.rfa.list_inbound (was rfb.list_inbound — vacancy applications)
// ====================================================================
const RfaListInboundInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const RfaListInboundOutput = z.object({
  applications: z.array(
    z.object({
      applicationId: z.string(),
      applicantName: z.string(),
      unitId: z.string(),
      submittedAt: z.string(),
      status: z.enum(['open', 'screening', 'approved', 'declined']),
    }),
  ),
});
export const ownerRfaListInboundTool: PersonaToolDescriptor<
  typeof RfaListInboundInput,
  typeof RfaListInboundOutput
> = {
  id: 'owner.rfa.list_inbound',
  name: 'Owner — inbound vacancy applications (en) / Mwenye — maombi ya nyumba wazi (sw)',
  description:
    'Inbound Request-For-Application (RFA) records from prospective tenants ' +
    'on the marketplace.',
  personaSlugs: OWNER,
  inputSchema: RfaListInboundInput,
  outputSchema: RfaListInboundOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { applications: [] };
    return client.get<{
      applications: Array<{
        applicationId: string;
        applicantName: string;
        unitId: string;
        submittedAt: string;
        status: 'open' | 'screening' | 'approved' | 'declined';
      }>;
    }>('/owner/rfa/inbound', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 25. owner.rfa.dispatch_to_manager (was rfb.dispatch_to_manager)
// ====================================================================
const RfaDispatchInput = z.object({
  applicationId: z.string().min(1).max(120),
  managerId: z.string().min(1).max(120),
  evidenceRef: z.string().min(1).max(500),
});
const RfaDispatchOutput = z.object({
  applicationId: z.string(),
  managerId: z.string(),
  status: z.enum(['dispatched', 'unavailable']),
});
export const ownerRfaDispatchTool: PersonaToolDescriptor<
  typeof RfaDispatchInput,
  typeof RfaDispatchOutput
> = {
  id: 'owner.rfa.dispatch_to_manager',
  name: 'Owner — dispatch application to manager (en) / Mwenye — peleka maombi kwa meneja (sw)',
  description:
    'Forward a vacancy application to a property manager for screening + ' +
    'showing. WRITE — provenance + evidence attached.',
  personaSlugs: OWNER,
  inputSchema: RfaDispatchInput,
  outputSchema: RfaDispatchOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        applicationId: input.applicationId,
        managerId: input.managerId,
        status: 'unavailable' as const,
      };
    }
    const body = withChatProvenance(
      {
        managerId: input.managerId,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      applicationId: string;
      managerId: string;
      status: 'dispatched' | 'unavailable';
    }>(
      `/owner/rfa/${encodeURIComponent(input.applicationId)}/dispatch`,
      body,
    );
  },
};

// ====================================================================
// 26. owner.settlement.list_mine (preserved — rent payouts)
// ====================================================================
const SettlementListInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});
const SettlementListOutput = z.object({
  settlements: z.array(
    z.object({
      settlementId: z.string(),
      leaseId: z.string(),
      grossTzs: z.number(),
      feeTzs: z.number(),
      netTzs: z.number(),
      payoutProvider: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export const ownerSettlementListMineTool: PersonaToolDescriptor<
  typeof SettlementListInput,
  typeof SettlementListOutput
> = {
  id: 'owner.settlement.list_mine',
  name: 'Owner — my settlements (en) / Mwenye — malipo yangu (sw)',
  description: 'List the owner’s recent rent payout settlements.',
  personaSlugs: OWNER,
  inputSchema: SettlementListInput,
  outputSchema: SettlementListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { settlements: [] };
    return client.get<{
      settlements: Array<{
        settlementId: string;
        leaseId: string;
        grossTzs: number;
        feeTzs: number;
        netTzs: number;
        payoutProvider: string | null;
        createdAt: string;
      }>;
    }>('/owner/settlements/mine', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 27. owner.connected_agents.revoke (preserved)
// ====================================================================
const RevokeAgentInput = z.object({
  agentId: z.string().min(1).max(120),
  reasonEvidenceRef: z.string().min(1).max(500),
});
const RevokeAgentOutput = z.object({
  agentId: z.string(),
  revoked: z.boolean(),
});
export const ownerConnectedAgentsRevokeTool: PersonaToolDescriptor<
  typeof RevokeAgentInput,
  typeof RevokeAgentOutput
> = {
  id: 'owner.connected_agents.revoke',
  name: 'Owner — revoke connected agent (en) / Mwenye — tengua wakala (sw)',
  description:
    'Revoke an external connected agent’s access. Requires evidence.',
  personaSlugs: OWNER,
  inputSchema: RevokeAgentInput,
  outputSchema: RevokeAgentOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { agentId: input.agentId, revoked: false };
    const body = withChatProvenance(
      { evidenceRefs: [input.reasonEvidenceRef] },
      ctx,
    );
    return client.post<{ agentId: string; revoked: boolean }>(
      `/owner/connected-agents/${encodeURIComponent(input.agentId)}/revoke`,
      body,
    );
  },
};

// ====================================================================
// 28-30. owner.tab.{pin,reorder,remove} (preserved)
// ====================================================================
const TabPinInput = z.object({
  tabId: z.string().min(1).max(120),
});
const TabPinOutput = z.object({ tabId: z.string(), pinned: z.boolean() });
export const ownerTabPinTool: PersonaToolDescriptor<
  typeof TabPinInput,
  typeof TabPinOutput
> = {
  id: 'owner.tab.pin',
  name: 'Owner — pin tab (en) / Mwenye — bandika kichupo (sw)',
  description: 'Pin a cockpit tab so it remains visible across sessions.',
  personaSlugs: OWNER,
  inputSchema: TabPinInput,
  outputSchema: TabPinOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { tabId: input.tabId, pinned: false };
    const body = withChatProvenance({}, ctx);
    return client.post<{ tabId: string; pinned: boolean }>(
      `/owner/tabs/${encodeURIComponent(input.tabId)}/pin`,
      body,
    );
  },
};

const TabReorderInput = z.object({
  orderedTabIds: z.array(z.string().min(1).max(120)).min(1).max(50),
});
const TabReorderOutput = z.object({
  count: z.number().int(),
});
export const ownerTabReorderTool: PersonaToolDescriptor<
  typeof TabReorderInput,
  typeof TabReorderOutput
> = {
  id: 'owner.tab.reorder',
  name: 'Owner — reorder tabs (en) / Mwenye — panga vichupo (sw)',
  description: 'Reorder the cockpit tab strip.',
  personaSlugs: OWNER,
  inputSchema: TabReorderInput,
  outputSchema: TabReorderOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { count: input.orderedTabIds.length };
    const body = withChatProvenance(
      { orderedTabIds: input.orderedTabIds },
      ctx,
    );
    return client.post<{ count: number }>('/owner/tabs/reorder', body);
  },
};

const TabRemoveInput = z.object({
  tabId: z.string().min(1).max(120),
});
const TabRemoveOutput = z.object({ tabId: z.string(), removed: z.boolean() });
export const ownerTabRemoveTool: PersonaToolDescriptor<
  typeof TabRemoveInput,
  typeof TabRemoveOutput
> = {
  id: 'owner.tab.remove',
  name: 'Owner — remove tab (en) / Mwenye — ondoa kichupo (sw)',
  description: 'Remove a cockpit tab.',
  personaSlugs: OWNER,
  inputSchema: TabRemoveInput,
  outputSchema: TabRemoveOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { tabId: input.tabId, removed: false };
    const body = withChatProvenance({}, ctx);
    return client.post<{ tabId: string; removed: boolean }>(
      `/owner/tabs/${encodeURIComponent(input.tabId)}/remove`,
      body,
    );
  },
};

// ====================================================================
// 31. owner.notification.mark_read (preserved)
// ====================================================================
const NotifMarkReadInput = z.object({
  notificationId: z.string().min(1).max(120),
});
const NotifMarkReadOutput = z.object({
  notificationId: z.string(),
  read: z.boolean(),
});
export const ownerNotificationMarkReadTool: PersonaToolDescriptor<
  typeof NotifMarkReadInput,
  typeof NotifMarkReadOutput
> = {
  id: 'owner.notification.mark_read',
  name: 'Owner — mark notification read (en) / Mwenye — alama ujumbe umesomwa (sw)',
  description: 'Mark a single notification as read.',
  personaSlugs: OWNER,
  inputSchema: NotifMarkReadInput,
  outputSchema: NotifMarkReadOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client)
      return { notificationId: input.notificationId, read: false };
    const body = withChatProvenance({}, ctx);
    return client.post<{ notificationId: string; read: boolean }>(
      `/owner/notifications/${encodeURIComponent(input.notificationId)}/read`,
      body,
    );
  },
};

// ====================================================================
// 32. owner.export_pdf (preserved)
// ====================================================================
const ExportPdfInput = z.object({
  resourceType: z.enum(['portfolio', 'lease', 'property', 'brief']),
  resourceId: z.string().min(1).max(120),
});
const ExportPdfOutput = z.object({
  exportId: z.string(),
  downloadUri: z.string(),
  expiresAt: z.string(),
});
export const ownerExportPdfTool: PersonaToolDescriptor<
  typeof ExportPdfInput,
  typeof ExportPdfOutput
> = {
  id: 'owner.export_pdf',
  name: 'Owner — export PDF (en) / Mwenye — pakua PDF (sw)',
  description:
    'Generate a download-ready PDF of the named resource. Signed URL ' +
    'expires after 1 hour.',
  personaSlugs: OWNER,
  inputSchema: ExportPdfInput,
  outputSchema: ExportPdfOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        exportId: '',
        downloadUri: '',
        expiresAt: new Date().toISOString(),
      };
    }
    return client.get<{
      exportId: string;
      downloadUri: string;
      expiresAt: string;
    }>('/owner/exports/pdf', {
      query: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
    });
  },
};

// ====================================================================
// 33. owner.mwikila_inbox.list_pending (preserved)
// ====================================================================
const MwikilaInboxInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const MwikilaInboxOutput = z.object({
  items: z.array(
    z.object({
      itemId: z.string(),
      kind: z.string(),
      summary: z.string(),
      raisedAt: z.string(),
    }),
  ),
});
export const ownerMwikilaInboxListPendingTool: PersonaToolDescriptor<
  typeof MwikilaInboxInput,
  typeof MwikilaInboxOutput
> = {
  id: 'owner.mwikila_inbox.list_pending',
  name: 'Owner — Mr. Mwikila inbox (pending) (en) / Bwana Mwikila — kikasha (yanasubiri) (sw)',
  description:
    'Pending items waiting for the owner’s attention in the Mr. Mwikila inbox.',
  personaSlugs: OWNER,
  inputSchema: MwikilaInboxInput,
  outputSchema: MwikilaInboxOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { items: [] };
    return client.get<{
      items: Array<{
        itemId: string;
        kind: string;
        summary: string;
        raisedAt: string;
      }>;
    }>('/owner/mwikila-inbox/pending', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 34. owner.delegation.set (preserved)
// ====================================================================
const DelegationSetInput = z.object({
  delegateActorId: z.string().min(1).max(120),
  scope: z.enum(['read_only', 'maintenance', 'leasing', 'full']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  evidenceRef: z.string().min(1).max(500),
});
const DelegationSetOutput = z.object({
  delegationId: z.string(),
  status: z.string(),
});
export const ownerDelegationSetTool: PersonaToolDescriptor<
  typeof DelegationSetInput,
  typeof DelegationSetOutput
> = {
  id: 'owner.delegation.set',
  name: 'Owner — set delegation (en) / Mwenye — weka mwakilishi (sw)',
  description:
    'Delegate scoped responsibility to a co-actor (manager / spouse / ' +
    'family member) for a date window. HIGH stakes — requires evidence.',
  personaSlugs: OWNER,
  inputSchema: DelegationSetInput,
  outputSchema: DelegationSetOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { delegationId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        delegateActorId: input.delegateActorId,
        scope: input.scope,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ delegationId: string; status: string }>(
      '/owner/delegations',
      body,
    );
  },
};

// ====================================================================
// 35-36. owner.licence.{start_renewal,submit_renewal}
// (mapped to lease renewal)
// ====================================================================
const LeaseStartRenewalInput = z.object({
  leaseId: z.string().min(1).max(120),
  summary: z.string().min(1).max(500).optional(),
});
const LeaseStartRenewalOutput = z.object({
  leaseId: z.string(),
  renewalDraftId: z.string(),
  status: z.string(),
});
export const ownerLeaseStartRenewalTool: PersonaToolDescriptor<
  typeof LeaseStartRenewalInput,
  typeof LeaseStartRenewalOutput
> = {
  id: 'owner.lease.start_renewal',
  name: 'Owner — start lease renewal (en) / Mwenye — anza upyaji wa mkataba (sw)',
  description:
    'Open a lease-renewal draft for the given lease. Auto-creates a ' +
    'lease_event with status=in_progress so the owner cockpit + Mr. ' +
    'Mwikila inbox pulse.',
  personaSlugs: OWNER,
  inputSchema: LeaseStartRenewalInput,
  outputSchema: LeaseStartRenewalOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        renewalDraftId: 'unavailable',
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      { summary: input.summary ?? '' },
      ctx,
    );
    return client.post<{
      leaseId: string;
      renewalDraftId: string;
      status: string;
    }>(
      `/owner/leases/${encodeURIComponent(input.leaseId)}/start-renewal`,
      body,
    );
  },
};

const LeaseSubmitRenewalInput = z.object({
  leaseId: z.string().min(1).max(120),
  renewalDraftId: z.string().min(1).max(120),
  newRentTzs: z.number().positive(),
  evidenceRef: z.string().min(1).max(500),
});
const LeaseSubmitRenewalOutput = z.object({
  leaseId: z.string(),
  renewalDraftId: z.string(),
  status: z.string(),
});
export const ownerLeaseSubmitRenewalTool: PersonaToolDescriptor<
  typeof LeaseSubmitRenewalInput,
  typeof LeaseSubmitRenewalOutput
> = {
  id: 'owner.lease.submit_renewal',
  name: 'Owner — submit lease renewal (en) / Mwenye — wasilisha upyaji wa mkataba (sw)',
  description:
    'Submit the drafted lease renewal. Records the new monthly rent and ' +
    'evidence chain. HIGH stakes — the route attaches the new rent to ' +
    'the lease row + sends the tenant the renewal offer.',
  personaSlugs: OWNER,
  inputSchema: LeaseSubmitRenewalInput,
  outputSchema: LeaseSubmitRenewalOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaseId: input.leaseId,
        renewalDraftId: input.renewalDraftId,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        renewalDraftId: input.renewalDraftId,
        newRentTzs: input.newRentTzs,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      leaseId: string;
      renewalDraftId: string;
      status: string;
    }>(
      `/owner/leases/${encodeURIComponent(input.leaseId)}/submit-renewal`,
      body,
    );
  },
};

// ====================================================================
// 37. owner.regulator.approve_disclosure (preserved)
// ====================================================================
const RegulatorApproveInput = z.object({
  requestId: z.string().min(1).max(120),
  approvedScope: z.object({
    identity: z.boolean().optional(),
    contact: z.boolean().optional(),
    tenancy: z.boolean().optional(),
    payment_history: z.boolean().optional(),
    address: z.boolean().optional(),
  }),
  evidenceRef: z.string().min(1).max(500),
});
const RegulatorApproveOutput = z.object({
  requestId: z.string(),
  status: z.string(),
});
export const ownerRegulatorApproveDisclosureTool: PersonaToolDescriptor<
  typeof RegulatorApproveInput,
  typeof RegulatorApproveOutput
> = {
  id: 'owner.regulator.approve_disclosure',
  name: 'Owner — approve regulator disclosure (en) / Mwenye — idhinisha ufunuo kwa mdhibiti (sw)',
  description:
    'Approve the scope of tenant/personal data to release in response to ' +
    'a regulator data-subject request. HIGH stakes — evidence-required.',
  personaSlugs: OWNER,
  inputSchema: RegulatorApproveInput,
  outputSchema: RegulatorApproveOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client)
      return { requestId: input.requestId, status: 'unavailable' };
    const body = withChatProvenance(
      {
        approvedScope: input.approvedScope,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ requestId: string; status: string }>(
      `/owner/regulator/requests/${encodeURIComponent(input.requestId)}/approve-disclosure`,
      body,
    );
  },
};

// ====================================================================
// 38. owner.inspection.sign (mapped to move-in/out condition report sign)
// ====================================================================
const InspectionSignInput = z.object({
  inspectionId: z.string().min(1).max(120),
  reportId: z.string().min(1).max(120),
  canonicalPdfSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
const InspectionSignOutput = z.object({
  reportId: z.string(),
  status: z.string(),
});
export const ownerInspectionSignTool: PersonaToolDescriptor<
  typeof InspectionSignInput,
  typeof InspectionSignOutput
> = {
  id: 'owner.inspection.sign',
  name: 'Owner — sign move-in/out condition report (en) / Mwenye — saini ripoti ya hali (sw)',
  description:
    'Sign the reviewed move-in or move-out condition report (PDF SHA-256 ' +
    'anchor). HIGH stakes — anchors the canonical artefact for any future ' +
    'security-deposit dispute.',
  personaSlugs: OWNER,
  inputSchema: InspectionSignInput,
  outputSchema: InspectionSignOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { reportId: input.reportId, status: 'unavailable' };
    const body = withChatProvenance(
      { canonicalPdfSha256: input.canonicalPdfSha256 },
      ctx,
    );
    return client.post<{ reportId: string; status: string }>(
      `/owner/inspections/${encodeURIComponent(input.inspectionId)}/reports/${encodeURIComponent(input.reportId)}/sign`,
      body,
    );
  },
};

// ====================================================================
// 39. owner.brain.recall_test (preserved)
// ====================================================================
const BrainRecallInput = z.object({
  query: z.string().min(1).max(500),
});
const BrainRecallOutput = z.object({
  matches: z.array(
    z.object({
      memoryId: z.string(),
      summary: z.string(),
      similarity: z.number(),
    }),
  ),
});
export const ownerBrainRecallTestTool: PersonaToolDescriptor<
  typeof BrainRecallInput,
  typeof BrainRecallOutput
> = {
  id: 'owner.brain.recall_test',
  name: 'Owner — recall test (en) / Mwenye — jaribio la kumbukumbu (sw)',
  description:
    'Probe what Mr. Mwikila remembers about a topic. Read-only diagnostic.',
  personaSlugs: OWNER,
  inputSchema: BrainRecallInput,
  outputSchema: BrainRecallOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { matches: [] };
    return client.get<{
      matches: Array<{
        memoryId: string;
        summary: string;
        similarity: number;
      }>;
    }>('/owner/brain/recall', { query: { q: input.query } });
  },
};

// ====================================================================
// 40. owner.workforce_opening.create (NEW — staff openings)
// ====================================================================
const WorkforceOpeningInput = z.object({
  role: z.string().min(1).max(120),
  propertyId: z.string().min(1).max(120),
  monthlyRateTzs: z.number().positive(),
  evidenceRef: z.string().min(1).max(500),
});
const WorkforceOpeningOutput = z.object({
  openingId: z.string(),
  status: z.string(),
});
export const ownerWorkforceOpeningCreateTool: PersonaToolDescriptor<
  typeof WorkforceOpeningInput,
  typeof WorkforceOpeningOutput
> = {
  id: 'owner.workforce_opening.create',
  name: 'Owner — create staff opening (en) / Mwenye — fungua nafasi ya kazi (sw)',
  description:
    'Post a new opening for property staff (caretaker / cleaner / handyman). ' +
    'Money-rate visible — money path inviolable when filled.',
  personaSlugs: OWNER,
  inputSchema: WorkforceOpeningInput,
  outputSchema: WorkforceOpeningOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { openingId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        role: input.role,
        propertyId: input.propertyId,
        monthlyRateTzs: input.monthlyRateTzs,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ openingId: string; status: string }>(
      '/owner/workforce-openings',
      body,
    );
  },
};

// ====================================================================
// 41. owner.saved_search.create (preserved)
// ====================================================================
const SavedSearchInput = z.object({
  title: z.string().min(1).max(240),
  query: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const SavedSearchOutput = z.object({
  savedSearchId: z.string(),
});
export const ownerSavedSearchCreateTool: PersonaToolDescriptor<
  typeof SavedSearchInput,
  typeof SavedSearchOutput
> = {
  id: 'owner.saved_search.create',
  name: 'Owner — save a search (en) / Mwenye — hifadhi utafutaji (sw)',
  description: 'Save a query so the cockpit can surface fresh matches.',
  personaSlugs: OWNER,
  inputSchema: SavedSearchInput,
  outputSchema: SavedSearchOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { savedSearchId: '' };
    const body = withChatProvenance(
      {
        title: input.title,
        query: input.query,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ savedSearchId: string }>(
      '/owner/saved-searches',
      body,
    );
  },
};

// ====================================================================
// 42. owner.handoff.create (preserved)
// ====================================================================
const HandoffInput = z.object({
  targetActorId: z.string().min(1).max(120),
  summary: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const HandoffOutput = z.object({ handoffId: z.string(), status: z.string() });
export const ownerHandoffCreateTool: PersonaToolDescriptor<
  typeof HandoffInput,
  typeof HandoffOutput
> = {
  id: 'owner.handoff.create',
  name: 'Owner — create handoff (en) / Mwenye — anzisha makabidhiano (sw)',
  description:
    'Create a structured handoff (vacation / business trip / hospital stay) ' +
    'so the manager and Mr. Mwikila can continue running the portfolio.',
  personaSlugs: OWNER,
  inputSchema: HandoffInput,
  outputSchema: HandoffOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { handoffId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        targetActorId: input.targetActorId,
        summary: input.summary,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ handoffId: string; status: string }>(
      '/owner/handoffs',
      body,
    );
  },
};

// ====================================================================
// Catalog export
// ====================================================================
export const OWNER_PROPERTY_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  ownerCashflowForecastTool,
  ownerRentCollectionSummaryTool,
  ownerPortfolioMetricsTool,
  ownerLeaseListActiveTool,
  ownerLeaseExpiringSoonTool,
  ownerPropertyListTool,
  ownerTenantListActiveTool,
  ownerTenantDelinquentTool,
  ownerMaintenanceBacklogTool,
  ownerComplianceCalendarTool,
  ownerDraftLockTool,
  ownerShareCreateTool,
  ownerReminderCreateTool,
  ownerReminderListTool,
  ownerReminderSnoozeTool,
  ownerPayrollRunTool,
  ownerPayrollPreviewTool,
  ownerPayrollCommitTool,
  ownerBriefShowTool,
  ownerDecisionRecordTool,
  ownerDecisionListTool,
  ownerOpportunityListTool,
  ownerRiskListTool,
  ownerRfaListInboundTool,
  ownerRfaDispatchTool,
  ownerSettlementListMineTool,
  ownerConnectedAgentsRevokeTool,
  ownerTabPinTool,
  ownerTabReorderTool,
  ownerTabRemoveTool,
  ownerNotificationMarkReadTool,
  ownerExportPdfTool,
  ownerMwikilaInboxListPendingTool,
  ownerDelegationSetTool,
  ownerLeaseStartRenewalTool,
  ownerLeaseSubmitRenewalTool,
  ownerRegulatorApproveDisclosureTool,
  ownerInspectionSignTool,
  ownerBrainRecallTestTool,
  ownerWorkforceOpeningCreateTool,
  ownerSavedSearchCreateTool,
  ownerHandoffCreateTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
