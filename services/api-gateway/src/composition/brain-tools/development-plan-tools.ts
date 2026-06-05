/**
 * Development pro-forma brain tools (real-estate edition) — Gap-4 (d).
 *
 * Ported from LitFin's business-plan-tools.ts
 * (src/core/litfin-ai/actions/tools/business-plan-tools.ts) and retargeted
 * lending → real estate. Where LitFin's tools drove a borrower BUSINESS
 * PLAN to support a loan application, these drive a property DEVELOPMENT
 * pro-forma a property owner / developer uses to plan a new build /
 * refurbishment.
 *
 * Section taxonomy retargeted (CLAUDE.md + Gap-4 spec):
 *   - management-organisation → staffing-plan
 *   - market-analysis         → tenant-demand
 *   - products-services       → unit-mix
 *   - use-of-loan             → use-of-funds
 *   - sector-performance      → location-market
 *
 * Financial assumptions retargeted to a development pro-forma
 * (unit_count / rent_per_unit_monthly / construction_cost_per_unit /
 * occupancy_ramp_months / exit_cap_rate / ...).
 *
 * Five tools backing `/property/../development-plans` (migration 0310):
 *   - `development.plan.generate`        WRITE: create a plan + seed
 *                                        default sections.
 *   - `development.plan.modify_section`  WRITE: upsert (generate / edit) a
 *                                        single section's EN + SW body.
 *   - `development.plan.manage_sections` READ:  list a plan's sections.
 *   - `development.plan.set_assumption`  WRITE: set one financial
 *                                        assumption (merges JSONB key).
 *   - `development.plan.validate`        READ:  completeness check over a
 *                                        plan's sections (never fabricates
 *                                        a score — counts real rows).
 *
 * Persona: owner strategist (T1) + admin strategist (T2). WRITE tools are
 * MEDIUM-stakes (additive plan rows, easily reversed) and wrap their POST
 * body with `withChatProvenance`. READ tools are LOW-stakes.
 *
 * Multi-currency (CLAUDE.md hard rule): a plan carries a `currencyCode`;
 * monetary assumptions live inside the assumptions JSONB (no jurisdiction
 * currency hard-coded). The display surface formats with formatCurrency.
 *
 * HONEST-DEGRADE (CLAUDE.md hard rule): the `/development-plans` route IS
 * wired (this commit), so the tools do a real loopback. When no loopback
 * client is bound (eg. unit tests, scheduled cron) every handler returns a
 * typed `available: false` shape — never a fabricated plan / section /
 * score. The route itself is the source of truth.
 */

import { z } from 'zod';
import type {
  PersonaToolDescriptor,
  PersonaToolHandlerContext,
} from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const OWNER_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

/** Canonical development pro-forma section ids (retargeted from LitFin). */
const SECTION_KEYS = [
  'cover-page',
  'executive-summary',
  'location-market',
  'tenant-demand',
  'unit-mix',
  'staffing-plan',
  'use-of-funds',
  'financial-overview',
  'risk-mitigation',
  'swot-analysis',
] as const;

/** Canonical financial-assumption keys (retargeted from LitFin). */
const ASSUMPTION_KEYS = [
  'unit_count',
  'rent_per_unit_monthly',
  'construction_cost_per_unit',
  'land_cost',
  'occupancy_ramp_months',
  'stabilised_occupancy_rate',
  'operating_margin',
  'loan_interest_rate',
  'loan_term_months',
  'equity_contribution',
  'inflation_rate',
  'discount_rate',
  'exit_cap_rate',
] as const;

function noClient(ctx: PersonaToolHandlerContext): boolean {
  return ctx.httpClient === undefined;
}

// ---------------------------------------------------------------------------
// 1. development.plan.generate (WRITE, MEDIUM)
// ---------------------------------------------------------------------------

const GenerateInput = z.object({
  title: z.string().min(1).max(200),
  propertyId: z.string().uuid().optional(),
  /** ISO-4217 code for the plan; never hard-coded. */
  currencyCode: z.string().length(3).optional(),
  /** Optional seed assumptions (assumptionKey -> finite number). */
  assumptions: z.record(z.number().finite()).optional(),
});
const GenerateOutput = z.object({
  available: z.boolean(),
  id: z.string(),
  title: z.string(),
  status: z.string(),
  currencyCode: z.string(),
});

export const developmentPlanGenerateTool: PersonaToolDescriptor<
  typeof GenerateInput,
  typeof GenerateOutput
> = {
  id: 'development.plan.generate',
  name: 'Development plan — start a pro-forma (en) / Mpango wa maendeleo — anza (sw)',
  description:
    'Create a property development pro-forma plan from chat and seed its ' +
    'default sections (cover-page, executive-summary, location-market, ' +
    'tenant-demand, unit-mix, staffing-plan, use-of-funds, ' +
    'financial-overview, risk-mitigation, swot-analysis). Use when the ' +
    'owner / developer says "draft a development plan for the Mikocheni ' +
    'site". title is required. currencyCode is optional (defaults to the ' +
    'tenant currency at the route — never hard-coded here). Returns the ' +
    'plan id to use with the other development.plan.* tools. Honest-' +
    'degrades to available:false when no loopback client is bound (never ' +
    'fabricates a plan).',
  personaSlugs: OWNER_ADMIN,
  inputSchema: GenerateInput,
  outputSchema: GenerateOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const fallback = {
      available: false,
      id: '',
      title: input.title,
      status: 'unavailable',
      currencyCode: input.currencyCode ?? '',
    };
    const client = ctx.httpClient;
    if (noClient(ctx) || !client) return fallback;

    const body: Record<string, unknown> = { title: input.title };
    if (input.propertyId !== undefined) body.propertyId = input.propertyId;
    if (input.currencyCode !== undefined) {
      body.currencyCode = input.currencyCode;
    }
    if (input.assumptions !== undefined) body.assumptions = input.assumptions;

    const response = await client.post<{
      success: boolean;
      data?: Record<string, unknown>;
    }>('/development-plans/plans', withChatProvenance(body, ctx));
    const row = response.data;
    if (!row) return fallback;
    return {
      available: true,
      id: String(row.id ?? ''),
      title: String(row.title ?? input.title),
      status: String(row.status ?? 'draft'),
      currencyCode: String(row.currency_code ?? input.currencyCode ?? ''),
    };
  },
};

// ---------------------------------------------------------------------------
// 2. development.plan.modify_section (WRITE, MEDIUM)
// ---------------------------------------------------------------------------

const ModifySectionInput = z.object({
  planId: z.string().uuid(),
  sectionKey: z.enum(SECTION_KEYS),
  titleEn: z.string().min(1).max(200).optional(),
  titleSw: z.string().min(1).max(200).optional(),
  bodyEn: z.string().max(20000).optional(),
  bodySw: z.string().max(20000).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
const ModifySectionOutput = z.object({
  available: z.boolean(),
  id: z.string(),
  sectionKey: z.string(),
  status: z.string(),
});

export const developmentPlanModifySectionTool: PersonaToolDescriptor<
  typeof ModifySectionInput,
  typeof ModifySectionOutput
> = {
  id: 'development.plan.modify_section',
  name: 'Development plan — write a section (en) / Mpango wa maendeleo — andika sehemu (sw)',
  description:
    'Generate or edit a single section of a development pro-forma (e.g. ' +
    'write the tenant-demand or unit-mix section). YOU compose the prose; ' +
    'pass bodyEn AND bodySw so the locale toggle stays absolute (both ' +
    'languages must be filled — never leave one empty). planId + ' +
    'sectionKey are required. Upserts (re-calling overwrites the same ' +
    'section). Honest-degrades to available:false when no loopback client ' +
    'is bound (never fabricates a section).',
  personaSlugs: OWNER_ADMIN,
  inputSchema: ModifySectionInput,
  outputSchema: ModifySectionOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const fallback = {
      available: false,
      id: '',
      sectionKey: input.sectionKey,
      status: 'unavailable',
    };
    const client = ctx.httpClient;
    if (noClient(ctx) || !client) return fallback;

    const body: Record<string, unknown> = { sectionKey: input.sectionKey };
    if (input.titleEn !== undefined) body.titleEn = input.titleEn;
    if (input.titleSw !== undefined) body.titleSw = input.titleSw;
    if (input.bodyEn !== undefined) body.bodyEn = input.bodyEn;
    if (input.bodySw !== undefined) body.bodySw = input.bodySw;
    if (input.sortOrder !== undefined) body.sortOrder = input.sortOrder;

    const response = await client.post<{
      success: boolean;
      data?: Record<string, unknown>;
    }>(
      `/development-plans/plans/${input.planId}/sections`,
      withChatProvenance(body, ctx),
    );
    const row = response.data;
    if (!row) return fallback;
    return {
      available: true,
      id: String(row.id ?? ''),
      sectionKey: String(row.section_key ?? input.sectionKey),
      status: String(row.status ?? 'ready'),
    };
  },
};

// ---------------------------------------------------------------------------
// 3. development.plan.manage_sections (READ, LOW)
// ---------------------------------------------------------------------------

const ManageSectionsInput = z.object({
  planId: z.string().uuid(),
});
const ManageSectionsOutput = z.object({
  available: z.boolean(),
  sections: z.array(
    z.object({
      sectionKey: z.string(),
      titleEn: z.string(),
      titleSw: z.string(),
      status: z.string(),
      sortOrder: z.number().int(),
      hasBody: z.boolean(),
    }),
  ),
});

export const developmentPlanManageSectionsTool: PersonaToolDescriptor<
  typeof ManageSectionsInput,
  typeof ManageSectionsOutput
> = {
  id: 'development.plan.manage_sections',
  name: 'Development plan — list sections (en) / Mpango wa maendeleo — orodha ya sehemu (sw)',
  description:
    'List the sections of a development pro-forma with their status and ' +
    'whether each has been written yet. Read-only. Use to see what is ' +
    'left to draft before validating. Honest-degrades to available:false ' +
    '(empty sections) when no loopback client is bound (never fabricates).',
  personaSlugs: OWNER_ADMIN,
  inputSchema: ManageSectionsInput,
  outputSchema: ManageSectionsOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (noClient(ctx) || !client) {
      return { available: false, sections: [] };
    }
    const response = await client.get<{
      success: boolean;
      data?: ReadonlyArray<Record<string, unknown>>;
    }>(`/development-plans/plans/${input.planId}/sections`, {});
    const rows = response.data ?? [];
    return {
      available: true,
      sections: rows.map((r) => {
        const bodyEn = String(r.body_en ?? '');
        const bodySw = String(r.body_sw ?? '');
        return {
          sectionKey: String(r.section_key ?? ''),
          titleEn: String(r.title_en ?? ''),
          titleSw: String(r.title_sw ?? ''),
          status: String(r.status ?? 'pending'),
          sortOrder: Number(r.sort_order ?? 0),
          hasBody: bodyEn.length > 0 || bodySw.length > 0,
        };
      }),
    };
  },
};

// ---------------------------------------------------------------------------
// 4. development.plan.set_assumption (WRITE, MEDIUM)
// ---------------------------------------------------------------------------

const SetAssumptionInput = z.object({
  planId: z.string().uuid(),
  assumptionKey: z.enum(ASSUMPTION_KEYS),
  value: z.number().finite(),
});
const SetAssumptionOutput = z.object({
  available: z.boolean(),
  id: z.string(),
  assumptionKey: z.string(),
  value: z.number(),
});

export const developmentPlanSetAssumptionTool: PersonaToolDescriptor<
  typeof SetAssumptionInput,
  typeof SetAssumptionOutput
> = {
  id: 'development.plan.set_assumption',
  name: 'Development plan — set an assumption (en) / Mpango wa maendeleo — weka dhana (sw)',
  description:
    'Set one financial assumption on a development pro-forma. ' +
    'assumptionKey is one of unit_count, rent_per_unit_monthly, ' +
    'construction_cost_per_unit, land_cost, occupancy_ramp_months, ' +
    'stabilised_occupancy_rate, operating_margin, loan_interest_rate, ' +
    'loan_term_months, equity_contribution, inflation_rate, discount_rate, ' +
    'exit_cap_rate. Monetary values are in the plan currency (never ' +
    'hard-coded). Use when the owner says "assume rent of 450 per unit" or ' +
    '"set the exit cap rate to 8.5". Merges the single key (does not ' +
    'clobber others). Honest-degrades to available:false when no loopback ' +
    'client is bound (never fabricates).',
  personaSlugs: OWNER_ADMIN,
  inputSchema: SetAssumptionInput,
  outputSchema: SetAssumptionOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const fallback = {
      available: false,
      id: '',
      assumptionKey: input.assumptionKey,
      value: input.value,
    };
    const client = ctx.httpClient;
    if (noClient(ctx) || !client) return fallback;

    const body: Record<string, unknown> = {
      assumptionKey: input.assumptionKey,
      value: input.value,
    };
    const response = await client.post<{
      success: boolean;
      data?: Record<string, unknown>;
    }>(
      `/development-plans/plans/${input.planId}/assumptions`,
      withChatProvenance(body, ctx),
    );
    const row = response.data;
    if (!row) return fallback;
    return {
      available: true,
      id: String(row.id ?? ''),
      assumptionKey: input.assumptionKey,
      value: input.value,
    };
  },
};

// ---------------------------------------------------------------------------
// 5. development.plan.validate (READ, LOW)
// ---------------------------------------------------------------------------

const ValidateInput = z.object({
  planId: z.string().uuid(),
});
const ValidateOutput = z.object({
  available: z.boolean(),
  totalSections: z.number().int().nonnegative(),
  readySections: z.number().int().nonnegative(),
  completenessPct: z.number().min(0).max(100),
  missingSections: z.array(z.string()),
});

export const developmentPlanValidateTool: PersonaToolDescriptor<
  typeof ValidateInput,
  typeof ValidateOutput
> = {
  id: 'development.plan.validate',
  name: 'Development plan — completeness check (en) / Mpango wa maendeleo — angalia ukamilifu (sw)',
  description:
    'Run a completeness check over a development pro-forma: how many ' +
    'sections are written (ready or have a body) vs total, plus which ' +
    'sections are still missing. Read-only — counts REAL rows, never ' +
    'fabricates a score. Use before presenting the plan to confirm nothing ' +
    'is blank. Honest-degrades to available:false when no loopback client ' +
    'is bound.',
  personaSlugs: OWNER_ADMIN,
  inputSchema: ValidateInput,
  outputSchema: ValidateOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (noClient(ctx) || !client) {
      return {
        available: false,
        totalSections: 0,
        readySections: 0,
        completenessPct: 0,
        missingSections: [],
      };
    }
    const response = await client.get<{
      success: boolean;
      data?: ReadonlyArray<Record<string, unknown>>;
    }>(`/development-plans/plans/${input.planId}/sections`, {});
    const rows = response.data ?? [];
    const totalSections = rows.length;
    const missingSections: string[] = [];
    let readySections = 0;
    for (const r of rows) {
      const bodyEn = String(r.body_en ?? '');
      const bodySw = String(r.body_sw ?? '');
      const status = String(r.status ?? 'pending');
      const written = status === 'ready' || bodyEn.length > 0 || bodySw.length > 0;
      if (written) {
        readySections += 1;
      } else {
        missingSections.push(String(r.section_key ?? ''));
      }
    }
    const completenessPct =
      totalSections > 0
        ? Math.round((readySections / totalSections) * 100)
        : 0;
    return {
      available: true,
      totalSections,
      readySections,
      completenessPct,
      missingSections,
    };
  },
};

// ---------------------------------------------------------------------------
// Export catalogue.
// ---------------------------------------------------------------------------

export const DEVELOPMENT_PLAN_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  developmentPlanGenerateTool,
  developmentPlanModifySectionTool,
  developmentPlanManageSectionsTool,
  developmentPlanSetAssumptionTool,
  developmentPlanValidateTool,
] as unknown as ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
>);
