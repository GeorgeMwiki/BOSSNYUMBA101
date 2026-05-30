/**
 * Risk-Scanner — brain tool catalog (BossNyumba real-estate).
 *
 * Wires the 33-rule risk scanner (`services/risk-scanner/`) into the
 * brain's persona-aware tool catalog. Ported from Borjie's
 * `risk-scanner-tools.ts`; mining terms (royalty exposure, ICA cert)
 * map to real-estate analogues (cash-flow, regulator filings,
 * vendor scorecard).
 *
 * Two tools surface here:
 *
 *   1. `property.risks.scan`
 *        Read-only. Walks the live tenant state via the existing
 *        `scanRisks(tenantId, deps)` engine, returns the top N risks
 *        ranked by severity-weight / max(1, timeToImpactDays). Pushes
 *        a cockpit `risk.changed` event for the highest-severity item
 *        so the owner-portal toast updates without polling.
 *
 *   2. `property.risks.list_rules`
 *        Read-only. Lists every rule the engine carries grouped by kind.
 *        Used when the owner asks "what kinds of risks do you watch?"
 *        so the answer cites real rule ids instead of fabricating them.
 *
 * Persona binding: T1 owner strategist + T2 admin strategist.
 *
 * Tier discipline: every tool is `isWrite: false`, `stakes: 'MEDIUM'`,
 * `requiresPolicyRuleLiteral: false`. Stakes reflects the higher policy
 * weight risk telemetry carries vs upside (risks may trigger four-eye
 * writes downstream when the owner acts on them).
 *
 * Tenant isolation: handlers resolve `tenantId` from the persona
 * context; the api-gateway middleware binds `app.tenant_id` so every
 * resolver SELECT scopes via RLS. No tool reaches across tenants.
 */

import { z } from 'zod';

import {
  countRulesByKind,
  listRules,
  scanRisks,
  type RiskScannerDeps,
} from '../../services/risk-scanner/index.js';
import { publishCockpitEvent } from '../../services/cockpit-events/index.js';
import type { PersonaToolDescriptor } from './types.js';

const OWNER_AND_ADMIN: ReadonlyArray<
  'T1_owner_strategist' | 'T2_admin_strategist'
> = ['T1_owner_strategist', 'T2_admin_strategist'];

const RISK_KIND_VALUES = [
  'cash_flow',
  'regulatory',
  'operational',
  'hr',
  'compliance',
  'counterparty',
  'market',
  'estate',
  'security',
  'reputational',
  'tax',
  'legal',
] as const;

const RISK_SEVERITY_VALUES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

interface ToolDeps {
  readonly db: RiskScannerDeps['db'];
  readonly now?: RiskScannerDeps['now'];
}

let injectedDeps: ToolDeps | null = null;

/**
 * Wire the database client at composition time. Called once from the
 * api-gateway composition root with the tenant-scoped DB pool.
 */
export function configureRiskScannerTools(deps: ToolDeps): void {
  injectedDeps = Object.freeze({
    db: deps.db,
    ...(deps.now !== undefined && { now: deps.now }),
  });
}

function requireDeps(): RiskScannerDeps {
  if (!injectedDeps) {
    throw new Error(
      'risk-scanner-tools: configureRiskScannerTools(deps) was not called at composition time',
    );
  }
  // Rebuild as a RiskScannerDeps — under `exactOptionalPropertyTypes`,
  // a `now?: () => Date` slot rejects `undefined`. Omit the key when
  // unset so the target shape matches exactly.
  return injectedDeps.now !== undefined
    ? { db: injectedDeps.db, now: injectedDeps.now }
    : { db: injectedDeps.db };
}

// ─────────────────────────────────────────────────────────────────────
// 1. property.risks.scan
// ─────────────────────────────────────────────────────────────────────

const ScanInput = z.object({
  maxResults: z.number().int().min(1).max(10).default(5),
  minSeverity: z.enum(RISK_SEVERITY_VALUES).default('medium'),
  kindFilter: z.array(z.enum(RISK_KIND_VALUES)).max(12).optional(),
  scopeIds: z.array(z.string().min(1).max(40)).max(8).optional(),
});

const RiskRow = z.object({
  id: z.string(),
  ruleId: z.string(),
  kind: z.enum(RISK_KIND_VALUES),
  severity: z.enum(RISK_SEVERITY_VALUES),
  headlineEn: z.string(),
  headlineSw: z.string(),
  exposureAmount: z.number().nullable(),
  currencyCode: z.string(),
  timeToImpactDays: z.number().int(),
  citations: z.array(z.string()),
});

const ScanOutput = z.object({
  generatedAt: z.string(),
  risks: z.array(RiskRow),
  totalRules: z.number().int(),
});

export const riskScanTool: PersonaToolDescriptor<
  typeof ScanInput,
  typeof ScanOutput
> = {
  id: 'property.risks.scan',
  name: 'Risks — scan',
  description:
    'Scan the tenant for threats (cash runway, regulator filings, ' +
    'maintenance backlog, vendor failures, HR attrition, counterparty ' +
    'default, market swings, security incidents). Returns top N ranked ' +
    'risks ordered by severity / time-to-impact. Read-only.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: ScanInput,
  outputSchema: ScanOutput,
  stakes: 'MEDIUM',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const deps = requireDeps();
    // `ScanRisksOptions` uses `limit` for the result-cap field — the
    // brain-tool input is named `maxResults` for user-facing clarity.
    const options: Parameters<typeof scanRisks>[2] = {
      limit: input.maxResults,
      minSeverity: input.minSeverity,
    };
    if (input.kindFilter && input.kindFilter.length > 0) {
      (
        options as {
          kindFilter?: ReadonlyArray<(typeof RISK_KIND_VALUES)[number]>;
        }
      ).kindFilter = input.kindFilter;
    }
    if (input.scopeIds && input.scopeIds.length > 0) {
      (options as { scopeIds?: ReadonlyArray<string> }).scopeIds =
        input.scopeIds;
    }
    const risks = await scanRisks(ctx.tenantId, deps, options);
    const nowIso = (deps.now?.() ?? new Date()).toISOString();

    // R6 — cockpit SSE notify. Push only the highest-severity new
    // risk; the owner-portal toast shows the severity badge so a flood
    // of low-severity items doesn't drown the channel.
    if (risks.length > 0) {
      const top = risks[0];
      if (top) {
        try {
          publishCockpitEvent({
            kind: 'risk.changed',
            tenantId: ctx.tenantId,
            emittedAt: nowIso,
            riskId: top.id,
            severity: top.severity,
            previousSeverity: null,
          });
        } catch {
          // Best-effort — bus failures must never crash the brain.
        }
      }
    }

    return {
      generatedAt: nowIso,
      risks: risks.map((r) => ({
        id: r.id,
        ruleId: r.ruleId,
        kind: r.kind,
        severity: r.severity,
        headlineEn: r.headline.en,
        headlineSw: r.headline.sw,
        exposureAmount: r.exposureAmount ?? null,
        currencyCode: r.currencyCode,
        timeToImpactDays: r.timeToImpactDays,
        citations: [...r.citations],
      })),
      totalRules: listRules().length,
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// 2. property.risks.list_rules
// ─────────────────────────────────────────────────────────────────────

const ListRulesInput = z.object({
  kindFilter: z.array(z.enum(RISK_KIND_VALUES)).max(12).optional(),
});

const RuleSummary = z.object({
  id: z.string(),
  kind: z.enum(RISK_KIND_VALUES),
  severity: z.enum(RISK_SEVERITY_VALUES),
  title: z.string(),
});

const KindCount = z.object({
  kind: z.enum(RISK_KIND_VALUES),
  count: z.number().int(),
});

const ListRulesOutput = z.object({
  rules: z.array(RuleSummary),
  totalRules: z.number().int(),
  rulesByKind: z.array(KindCount),
});

export const riskListRulesTool: PersonaToolDescriptor<
  typeof ListRulesInput,
  typeof ListRulesOutput
> = {
  id: 'property.risks.list_rules',
  name: 'Risks — list rules',
  description:
    'List every risk-detection rule the brain checks for. Returns the rule ' +
    'id, risk kind, severity tier, and a short title. Read-only; surfaces ' +
    'the rule catalogue so the brain can cite real ids when explaining ' +
    'what it watches.',
  personaSlugs: OWNER_AND_ADMIN,
  inputSchema: ListRulesInput,
  outputSchema: ListRulesOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input) {
    const kindFilter =
      input.kindFilter && input.kindFilter.length > 0
        ? new Set<(typeof RISK_KIND_VALUES)[number]>(input.kindFilter)
        : null;
    const all = listRules();
    const rules = all
      .filter((r) => !kindFilter || kindFilter.has(r.kind))
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        severity: r.severity,
        title: r.id
          .replace(/[-_.]/g, ' ')
          .replace(/^./, (c) => c.toUpperCase()),
      }));
    const counts = countRulesByKind();
    const rulesByKind = (
      Object.entries(counts) as Array<
        [(typeof RISK_KIND_VALUES)[number], number]
      >
    ).map(([kind, count]) => ({ kind, count }));
    return { rules, totalRules: all.length, rulesByKind };
  },
};

// ─────────────────────────────────────────────────────────────────────
// Catalog barrel
// ─────────────────────────────────────────────────────────────────────

// Cast through `as unknown as` so the array literal of two descriptors
// with different concrete zod generics collapses to the catalog's
// covariant `PersonaToolDescriptor<ZodTypeAny, ZodTypeAny>` shape.
export const RISK_SCANNER_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  riskScanTool,
  riskListRulesTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
