/**
 * Opportunity scan rules — real-estate domain.
 *
 * Curated starter set of property-management opportunity rules.
 * Bilingual sw/en, evidence-cited, scope-tagged. Brain agent or
 * follow-up port can extend this catalog without changing the
 * scanner engine.
 *
 * Rule ids are stable so the FE can dedupe across scans and link
 * to a deeper explanation.
 */

import type { Opportunity, ScanRule, ScanState } from './types.js';

const PRIMARY_CURRENCY_DEFAULT = 'TZS';

function pickCurrency(state: ScanState): string {
  return state.primaryCurrencyCode || PRIMARY_CURRENCY_DEFAULT;
}

/* ------------------------------------------------------------------ */
/* 1 — Vacancy reduction: portfolio vacancy is above peer P25.        */
/* ------------------------------------------------------------------ */

const reduceVacancyRule: ScanRule = {
  id: 'reduce_vacancy_to_peer_p25',
  kind: 'revenue',
  requiresAction: true,
  detect(state: ScanState): boolean {
    const p = state.portfolio;
    if (!p) return false;
    if (p.vacancyRatePct == null) return false;
    if (p.portfolioRolePeerP25VacancyRatePct == null) return false;
    return p.vacancyRatePct > p.portfolioRolePeerP25VacancyRatePct + 2;
  },
  evaluate(state: ScanState): Opportunity {
    const p = state.portfolio!;
    const gap =
      (p.vacancyRatePct ?? 0) - (p.portfolioRolePeerP25VacancyRatePct ?? 0);
    const recoveredUnits = Math.floor(p.totalUnits * (gap / 100));
    const monthlyRent = p.totalRentRollMonthly
      ? p.totalRentRollMonthly / Math.max(p.occupiedUnits, 1)
      : null;
    const annualRevenue =
      monthlyRent != null ? recoveredUnits * monthlyRent * 12 : null;

    return {
      id: 'reduce_vacancy_to_peer_p25',
      kind: 'revenue',
      headline: {
        en: `Reduce vacancy by ${gap.toFixed(1)} pp — peer P25 portfolios run ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}%`,
        sw: `Punguza nafasi zilizo wazi kwa pp ${gap.toFixed(1)} — kanda za P25 hufanya ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}%`,
      },
      narrative: {
        en: `Your portfolio vacancy is ${(p.vacancyRatePct ?? 0).toFixed(1)}%; peer P25 is ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}%. Recovering ${recoveredUnits} units would lift annual rent receipts.`,
        sw: `Nafasi zako wazi ni asilimia ${(p.vacancyRatePct ?? 0).toFixed(1)}; P25 ya kanda ni asilimia ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}. Kupata wapangaji wa vyumba ${recoveredUnits} kungeongeza mapato ya kodi ya mwaka.`,
      },
      ...(annualRevenue != null ? { expectedValue: annualRevenue } : {}),
      currencyCode: pickCurrency(state),
      confidence: 0.7,
      timeWindowDays: 90,
      requiresActions: [
        {
          action: 'launch_vacancy_campaign',
          target: 'marketing',
          payload: { recoveredUnitsTarget: recoveredUnits },
        },
      ],
      relatedScopes: ['portfolio', 'marketing'],
      citations: ['portfolio.vacancyRatePct', 'portfolio.peerP25VacancyRatePct'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 2 — Rent uplift: portfolio sits below market by ≥10%.              */
/* ------------------------------------------------------------------ */

const rentUpliftRule: ScanRule = {
  id: 'lift_rent_to_market',
  kind: 'revenue',
  requiresAction: true,
  detect(state: ScanState): boolean {
    const m = state.market;
    if (!m) return false;
    if (m.tenantRentBelowMarketPct == null) return false;
    return m.tenantRentBelowMarketPct >= 10;
  },
  evaluate(state: ScanState): Opportunity {
    const m = state.market!;
    const gapPct = m.tenantRentBelowMarketPct ?? 0;
    const upliftPerUnit =
      m.portfolioAvgRentPerUnit != null
        ? m.portfolioAvgRentPerUnit * (gapPct / 100)
        : null;
    const p = state.portfolio;
    const annualUplift =
      upliftPerUnit != null && p
        ? upliftPerUnit * p.occupiedUnits * 12
        : null;

    return {
      id: 'lift_rent_to_market',
      kind: 'revenue',
      headline: {
        en: `Rent is ${gapPct.toFixed(1)}% below market — phased uplift over 12 months`,
        sw: `Kodi yako iko chini ya soko kwa asilimia ${gapPct.toFixed(1)} — ongezeko la awamu kwa miezi 12`,
      },
      narrative: {
        en: `Comparable units in your sub-market rent ${gapPct.toFixed(1)}% higher than your portfolio average. Roll a phased uplift on renewals to recapture this revenue without raising vacancy risk.`,
        sw: `Vyumba kama vyako katika eneo lako vinapangishwa kwa asilimia ${gapPct.toFixed(1)} zaidi ya wastani wako. Anzisha ongezeko la kodi kwa awamu wakati wa upyaisho ili kupata mapato haya bila kuongeza hatari ya kukosa wapangaji.`,
      },
      ...(annualUplift != null ? { expectedValue: annualUplift } : {}),
      currencyCode: pickCurrency(state),
      confidence: 0.75,
      timeWindowDays: 180,
      requiresActions: [
        {
          action: 'schedule_phased_rent_uplift',
          target: 'leases',
          payload: { gapPct, horizonMonths: 12 },
        },
      ],
      relatedScopes: ['leases', 'market'],
      citations: ['market.tenantRentBelowMarketPct', 'market.portfolioAvgRentPerUnit'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 3 — Lease renewals batch: ≥5 leases expire in 90 days.            */
/* ------------------------------------------------------------------ */

const batchLeaseRenewalsRule: ScanRule = {
  id: 'batch_lease_renewals_90d',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state: ScanState): boolean {
    const m = state.market;
    if (!m) return false;
    return m.leasesExpiringIn90dCount >= 5;
  },
  evaluate(state: ScanState): Opportunity {
    const m = state.market!;
    const count = m.leasesExpiringIn90dCount;
    return {
      id: 'batch_lease_renewals_90d',
      kind: 'operational_arbitrage',
      headline: {
        en: `Batch ${count} renewals expiring in 90 days — cuts admin cost ~40%`,
        sw: `Kusanyiya pamoja upyaisho ${count} unaomalizika ndani ya siku 90 — kupunguza gharama za usimamizi takriban asilimia 40`,
      },
      narrative: {
        en: `${count} leases expire in 90 days. Batching renewal letters + condition-report visits saves staff time and yields a unified rent uplift narrative.`,
        sw: `Mikataba ${count} inamalizika ndani ya siku 90. Kuyaunganisha pamoja mawasiliano ya upyaisho na ukaguzi wa hali ya nyumba huokoa muda wa wafanyikazi na kutoa hadithi moja ya ongezeko la kodi.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: 0.85,
      timeWindowDays: 90,
      requiresActions: [
        {
          action: 'open_batch_renewal_kanban',
          target: 'leases.renewals',
          payload: { leaseCount: count },
        },
      ],
      relatedScopes: ['leases', 'operations'],
      citations: ['market.leasesExpiringIn90dCount'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 4 — Insurance re-quote: policy due within 60d.                    */
/* ------------------------------------------------------------------ */

const insuranceQuoteRule: ScanRule = {
  id: 'insurance_remarket_60d',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state: ScanState): boolean {
    const ins = state.insurance;
    if (!ins) return false;
    if (!ins.policyDueWithin60d) return false;
    if (ins.currentAnnualPremium == null) return false;
    if (ins.bestMarketQuote == null) return false;
    return ins.bestMarketQuote < ins.currentAnnualPremium * 0.92;
  },
  evaluate(state: ScanState): Opportunity {
    const ins = state.insurance!;
    const saving =
      (ins.currentAnnualPremium ?? 0) - (ins.bestMarketQuote ?? 0);
    return {
      id: 'insurance_remarket_60d',
      kind: 'cost_saving',
      headline: {
        en: 'Re-quote insurance — best market saves materially',
        sw: 'Pata bei mpya ya bima — soko bora linaokoa fedha kubwa',
      },
      narrative: {
        en: `Your policy is due within 60 days. The best comparable market quote is materially lower than your current premium — re-bind on renewal.`,
        sw: `Bima yako inamalizika ndani ya siku 60. Bei bora kutoka soko ni ya chini kuliko bima yako ya sasa — fanya bima upya wakati wa upyaisho.`,
      },
      expectedValue: saving,
      currencyCode: pickCurrency(state),
      confidence: 0.8,
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'open_insurance_remarket_brief',
          target: 'insurance',
          payload: { saving },
        },
      ],
      relatedScopes: ['insurance'],
      citations: ['insurance.bestMarketQuote', 'insurance.currentAnnualPremium'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 5 — Capital: idle cash >90 days, T-bills yield available.         */
/* ------------------------------------------------------------------ */

const treasuryYieldRule: ScanRule = {
  id: 'park_idle_cash_in_tbills',
  kind: 'capital',
  requiresAction: true,
  detect(state: ScanState): boolean {
    const c = state.capital;
    if (!c) return false;
    if (c.idleCashOver90d == null || c.idleCashOver90d <= 0) return false;
    if (c.tibillsYieldPct == null || c.tibillsYieldPct <= 0) return false;
    return c.idleCashOver90d >= 10_000_000;
  },
  evaluate(state: ScanState): Opportunity {
    const c = state.capital!;
    const idle = c.idleCashOver90d ?? 0;
    const yieldPct = c.tibillsYieldPct ?? 0;
    const annualYield = idle * (yieldPct / 100);
    return {
      id: 'park_idle_cash_in_tbills',
      kind: 'capital',
      headline: {
        en: `Park idle cash in T-bills — ~${yieldPct.toFixed(1)}% annual yield`,
        sw: `Weka fedha ambazo hazifanyi kazi katika hati za hazina za muda mfupi — mapato ya takriban asilimia ${yieldPct.toFixed(1)} kwa mwaka`,
      },
      narrative: {
        en: `You hold idle cash over 90 days. Treasury bills currently yield ${yieldPct.toFixed(1)}% — laddering the surplus preserves liquidity while capturing yield.`,
        sw: `Una fedha ambazo hazifanyi kazi zaidi ya siku 90. Hati za hazina zinapata mapato ya asilimia ${yieldPct.toFixed(1)} sasa hivi — kuziwekeza kwa hatua hudumisha uwezo wa kutumia fedha hizo huku ukikamata mapato.`,
      },
      expectedValue: annualYield,
      currencyCode: pickCurrency(state),
      confidence: 0.85,
      timeWindowDays: 30,
      requiresActions: [
        {
          action: 'draft_treasury_ladder',
          target: 'treasury',
          payload: { tenor: '91d', principal: idle },
        },
      ],
      relatedScopes: ['treasury', 'capital'],
      citations: ['capital.idleCashOver90d', 'capital.tibillsYieldPct'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 6 — Maintenance backlog: ≥P75 peer maintenance backlog.            */
/* ------------------------------------------------------------------ */

const maintenanceBacklogRule: ScanRule = {
  id: 'clear_maintenance_backlog',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state: ScanState): boolean {
    const o = state.ops;
    if (!o) return false;
    if (o.maintenanceBacklogP25 == null) return false;
    return o.maintenanceBacklogCount > o.maintenanceBacklogP25 * 1.5;
  },
  evaluate(state: ScanState): Opportunity {
    const o = state.ops!;
    const overflow = o.maintenanceBacklogCount - (o.maintenanceBacklogP25 ?? 0);
    return {
      id: 'clear_maintenance_backlog',
      kind: 'operational_arbitrage',
      headline: {
        en: `Maintenance backlog ${overflow} above peer P25 — risk of tenant churn`,
        sw: `Kazi za matengenezo ${overflow} zaidi ya P25 ya kanda — hatari ya wapangaji kuondoka`,
      },
      narrative: {
        en: `Open maintenance tickets exceed peer P25 by ${overflow}. Backlogs above this band correlate with 2-week longer turnaround and elevated churn risk. Burn it down this sprint.`,
        sw: `Tiketi za matengenezo zilizo wazi zinazidi P25 ya kanda kwa ${overflow}. Kazi nyingi zilizosalia hubadili muda wa kushughulikia kuwa wiki 2 zaidi na huongeza hatari ya wapangaji kuondoka. Maliza sprint hii.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: 0.7,
      timeWindowDays: 14,
      requiresActions: [
        {
          action: 'open_maintenance_burn_down_board',
          target: 'maintenance',
          payload: { overflowCount: overflow },
        },
      ],
      relatedScopes: ['maintenance'],
      citations: ['ops.maintenanceBacklogCount', 'ops.maintenanceBacklogP25'],
    };
  },
};

// ─── Catalog ────────────────────────────────────────────────────────

export const SCAN_RULES: ReadonlyArray<ScanRule> = Object.freeze([
  reduceVacancyRule,
  rentUpliftRule,
  batchLeaseRenewalsRule,
  insuranceQuoteRule,
  treasuryYieldRule,
  maintenanceBacklogRule,
]);

export const ALL_SCAN_RULES = SCAN_RULES;
