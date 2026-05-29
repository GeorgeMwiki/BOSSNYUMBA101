/**
 * Opportunity scan rules — real-estate domain (33 rules).
 *
 * Curated catalog of property-management opportunity rules ported from
 * Borjie's 33-rule mining scanner. Each rule:
 *
 *   - Implements `ScanRule` with `detect()` (cheap) + `evaluate()` (heavy)
 *   - Has a bilingual sw/en headline and narrative (senior property-COO voice)
 *   - Returns a projected primary-currency impact when grounded in data,
 *     `null` otherwise (never fabricate)
 *   - Cites the resolver paths it consumed so the audit chain holds
 *
 * Rule ids are stable so the FE can dedupe across scans and link to a
 * deeper explanation. Symmetry rule (with risk-scanner): when a rule
 * ties on urgency with a risk-scanner rule, risk wins the tie-breaker.
 *
 * Categories (12 kinds × ~2.7 rules each):
 *   - revenue              — vacancy, rent uplift, sublet, off-market acq
 *   - cost_saving          — insurance, energy, vendor consolidation
 *   - tax_efficiency       — abatements, withholding, capex timing
 *   - regulatory_window    — section-21/32, amnesty, service-charge audit
 *   - capital              — T-bills, refinance, mortgage refi
 *   - market_timing        — corporate counterparty premium
 *   - operational_arbitrage — batch renewals, maintenance bundle, turnaround
 *   - hr                   — apprenticeship subsidy
 *   - compliance_shortcut  — insurance auto-renew, cert batching
 *   - estate_planning      — holding-co, succession, concentration risk
 *   - counterparty         — corporate tenant premium
 *   - peer_best_practice   — top-quartile occupancy pattern
 */

import type { Opportunity, ScanRule, ScanState } from './types.js';

const PRIMARY_CURRENCY_DEFAULT = 'TZS';

function pickCurrency(state: ScanState): string {
  return state.primaryCurrencyCode || PRIMARY_CURRENCY_DEFAULT;
}

function nonNegative(n: number): number {
  return Math.max(0, Math.round(n));
}

function clampConfidence(raw: number): number {
  if (Number.isNaN(raw)) return 0.5;
  return Math.max(0.05, Math.min(0.99, raw));
}

/* ============================================================ */
/* 1. REVENUE — vacancy reduction to peer P25                   */
/* ============================================================ */

const reduceVacancyRule: ScanRule = {
  id: 'reduce_vacancy_to_peer_p25',
  kind: 'revenue',
  requiresAction: true,
  detect(state) {
    const p = state.portfolio;
    if (!p) return false;
    if (p.vacancyRatePct == null) return false;
    if (p.portfolioRolePeerP25VacancyRatePct == null) return false;
    return p.vacancyRatePct > p.portfolioRolePeerP25VacancyRatePct + 2;
  },
  evaluate(state) {
    const p = state.portfolio!;
    const gap = (p.vacancyRatePct ?? 0) - (p.portfolioRolePeerP25VacancyRatePct ?? 0);
    const recoveredUnits = Math.floor(p.totalUnits * (gap / 100));
    const monthlyRent =
      p.totalRentRollMonthly != null
        ? p.totalRentRollMonthly / Math.max(p.occupiedUnits, 1)
        : null;
    const annualRevenue =
      monthlyRent != null ? recoveredUnits * monthlyRent * 12 : null;
    return {
      id: 'reduce_vacancy_to_peer_p25',
      kind: 'revenue',
      headline: {
        en: `Reduce vacancy by ${gap.toFixed(1)} pp — peer P25 portfolios run ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}%`,
        sw: `Punguza nafasi zilizo wazi kwa pp ${gap.toFixed(1)} — wenzio bora wanafanya asilimia ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}`,
      },
      narrative: {
        en: `Your portfolio vacancy is ${(p.vacancyRatePct ?? 0).toFixed(1)}%; peer P25 is ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}%. Recovering ${recoveredUnits} units lifts annual rent receipts.`,
        sw: `Nafasi zako wazi ni asilimia ${(p.vacancyRatePct ?? 0).toFixed(1)}; P25 ya wenzio ni asilimia ${(p.portfolioRolePeerP25VacancyRatePct ?? 0).toFixed(1)}. Kupata wapangaji wa vyumba ${recoveredUnits} kunaongeza mapato ya mwaka.`,
      },
      ...(annualRevenue != null ? { expectedValue: nonNegative(annualRevenue) } : {}),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
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

/* ============================================================ */
/* 2. REVENUE — rent uplift to market                           */
/* ============================================================ */

const rentUpliftRule: ScanRule = {
  id: 'lift_rent_to_market',
  kind: 'revenue',
  requiresAction: true,
  detect(state) {
    const m = state.market;
    if (!m || m.tenantRentBelowMarketPct == null) return false;
    return m.tenantRentBelowMarketPct >= 10;
  },
  evaluate(state) {
    const m = state.market!;
    const gapPct = m.tenantRentBelowMarketPct ?? 0;
    const upliftPerUnit =
      m.portfolioAvgRentPerUnit != null
        ? m.portfolioAvgRentPerUnit * (gapPct / 100)
        : null;
    const p = state.portfolio;
    const annualUplift =
      upliftPerUnit != null && p ? upliftPerUnit * p.occupiedUnits * 12 : null;
    return {
      id: 'lift_rent_to_market',
      kind: 'revenue',
      headline: {
        en: `Rent is ${gapPct.toFixed(1)}% below market — phased uplift over 12 months`,
        sw: `Kodi yako iko chini ya soko kwa asilimia ${gapPct.toFixed(1)} — ongezeko la awamu kwa miezi 12`,
      },
      narrative: {
        en: `Comparable units in your sub-market rent ${gapPct.toFixed(1)}% higher than your portfolio average. Roll a phased uplift on renewals to recapture this revenue without raising vacancy risk.`,
        sw: `Vyumba kama vyako vinapangishwa kwa asilimia ${gapPct.toFixed(1)} zaidi ya wastani wako. Anzisha ongezeko la kodi kwa awamu wakati wa upyaisho ili kupata mapato haya bila kuongeza hatari.`,
      },
      ...(annualUplift != null ? { expectedValue: nonNegative(annualUplift) } : {}),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.75),
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

/* ============================================================ */
/* 3. OPERATIONAL_ARBITRAGE — batch lease renewals (90d window) */
/* ============================================================ */

const batchLeaseRenewalsRule: ScanRule = {
  id: 'batch_lease_renewals_90d',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state) {
    const m = state.market;
    return m != null && m.leasesExpiringIn90dCount >= 5;
  },
  evaluate(state) {
    const m = state.market!;
    const count = m.leasesExpiringIn90dCount;
    return {
      id: 'batch_lease_renewals_90d',
      kind: 'operational_arbitrage',
      headline: {
        en: `Batch ${count} renewals expiring in 90 days — cuts admin cost ~40%`,
        sw: `Kusanya pamoja upyaisho ${count} unaomalizika ndani ya siku 90 — punguza gharama za usimamizi takriban asilimia 40`,
      },
      narrative: {
        en: `${count} leases expire in 90 days. Batching renewal letters + condition-report visits saves staff time and yields a unified rent-uplift narrative.`,
        sw: `Mikataba ${count} inamalizika ndani ya siku 90. Kuunganisha mawasiliano ya upyaisho kunaokoa muda wa wafanyikazi na kutoa hadithi moja ya ongezeko.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.85),
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

/* ============================================================ */
/* 4. COST_SAVING — insurance re-marketing                      */
/* ============================================================ */

const insuranceQuoteRule: ScanRule = {
  id: 'insurance_remarket_60d',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state) {
    const ins = state.insurance;
    if (!ins || !ins.policyDueWithin60d) return false;
    if (ins.currentAnnualPremium == null || ins.bestMarketQuote == null) return false;
    return ins.bestMarketQuote < ins.currentAnnualPremium * 0.92;
  },
  evaluate(state) {
    const ins = state.insurance!;
    const saving = (ins.currentAnnualPremium ?? 0) - (ins.bestMarketQuote ?? 0);
    return {
      id: 'insurance_remarket_60d',
      kind: 'cost_saving',
      headline: {
        en: 'Re-quote insurance — best market saves materially',
        sw: 'Pata bei mpya ya bima — soko bora linaokoa fedha kubwa',
      },
      narrative: {
        en: `Your policy is due within 60 days. The best comparable market quote is materially lower than your current premium — re-bind on renewal.`,
        sw: `Bima yako inamalizika ndani ya siku 60. Bei bora kutoka soko ni chini ya bima yako ya sasa — fanya bima upya wakati wa upyaisho.`,
      },
      expectedValue: nonNegative(saving),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.8),
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

/* ============================================================ */
/* 5. CAPITAL — park idle cash in T-bills                       */
/* ============================================================ */

const treasuryYieldRule: ScanRule = {
  id: 'park_idle_cash_in_tbills',
  kind: 'capital',
  requiresAction: true,
  detect(state) {
    const c = state.capital;
    if (!c) return false;
    if (c.idleCashOver90d == null || c.idleCashOver90d <= 0) return false;
    if (c.tibillsYieldPct == null || c.tibillsYieldPct <= 0) return false;
    return c.idleCashOver90d >= 10_000_000;
  },
  evaluate(state) {
    const c = state.capital!;
    const idle = c.idleCashOver90d ?? 0;
    const yieldPct = c.tibillsYieldPct ?? 0;
    const annualYield = idle * (yieldPct / 100);
    return {
      id: 'park_idle_cash_in_tbills',
      kind: 'capital',
      headline: {
        en: `Park idle cash in T-bills — ~${yieldPct.toFixed(1)}% annual yield`,
        sw: `Weka fedha zisizotumika katika hati za hazina — mapato ya takriban asilimia ${yieldPct.toFixed(1)} kwa mwaka`,
      },
      narrative: {
        en: `You hold idle cash over 90 days. Treasury bills currently yield ${yieldPct.toFixed(1)}% — laddering preserves liquidity while capturing yield.`,
        sw: `Una fedha zisizotumika zaidi ya siku 90. Hati za hazina zinapata mapato ya asilimia ${yieldPct.toFixed(1)} sasa — kuziwekeza kwa ngazi hudumisha uwezo wa kutumia fedha hizo huku ukikamata mapato.`,
      },
      expectedValue: nonNegative(annualYield),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.85),
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

/* ============================================================ */
/* 6. OPERATIONAL_ARBITRAGE — clear maintenance backlog         */
/* ============================================================ */

const maintenanceBacklogRule: ScanRule = {
  id: 'clear_maintenance_backlog',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state) {
    const o = state.ops;
    if (!o || o.maintenanceBacklogP25 == null) return false;
    return o.maintenanceBacklogCount > o.maintenanceBacklogP25 * 1.5;
  },
  evaluate(state) {
    const o = state.ops!;
    const overflow = o.maintenanceBacklogCount - (o.maintenanceBacklogP25 ?? 0);
    return {
      id: 'clear_maintenance_backlog',
      kind: 'operational_arbitrage',
      headline: {
        en: `Maintenance backlog ${overflow} above peer P25 — risk of tenant churn`,
        sw: `Kazi za matengenezo ${overflow} zaidi ya P25 ya wenzio — hatari ya wapangaji kuondoka`,
      },
      narrative: {
        en: `Open maintenance tickets exceed peer P25 by ${overflow}. Backlogs above this band correlate with 2-week longer turnaround and elevated churn risk. Burn it down this sprint.`,
        sw: `Tiketi za matengenezo zinazidi P25 kwa ${overflow}. Kazi nyingi zilizosalia hubadilisha muda wa kushughulikia kuwa wiki 2 zaidi. Maliza sprint hii.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
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

/* ============================================================ */
/* 7. REVENUE — long-vacant unit listing refresh                */
/* ============================================================ */

const longVacantRefreshRule: ScanRule = {
  id: 'refresh_long_vacant_listings',
  kind: 'revenue',
  requiresAction: true,
  detect(state) {
    return (state.portfolio?.longVacantUnitsStaleListingCount ?? 0) >= 3;
  },
  evaluate(state) {
    const p = state.portfolio!;
    const count = p.longVacantUnitsStaleListingCount;
    const monthlyRent =
      p.totalRentRollMonthly != null
        ? p.totalRentRollMonthly / Math.max(p.occupiedUnits, 1)
        : null;
    const monthlyRevenue =
      monthlyRent != null ? count * monthlyRent : null;
    return {
      id: 'refresh_long_vacant_listings',
      kind: 'revenue',
      headline: {
        en: `Refresh ${count} stale long-vacant listings — recapture marketing reach`,
        sw: `Sasisha matangazo ${count} ya nyumba zilizokaa wazi muda mrefu — pata wateja wapya`,
      },
      narrative: {
        en: `${count} units sit vacant >60 days with stale listings (no photo update, no price tweak). A refresh push (new photos + price test) typically halves time-to-fill.`,
        sw: `Nyumba ${count} zimekaa wazi zaidi ya siku 60 na matangazo yaliyochakaa. Kusasisha (picha mpya + jaribio la bei) hupunguza muda wa kupata wapangaji kwa nusu.`,
      },
      ...(monthlyRevenue != null ? { expectedValue: nonNegative(monthlyRevenue * 12) } : {}),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.72),
      timeWindowDays: 30,
      requiresActions: [
        {
          action: 'launch_listing_refresh_campaign',
          target: 'marketing',
          payload: { staleListingCount: count },
        },
      ],
      relatedScopes: ['portfolio', 'marketing'],
      citations: ['portfolio.longVacantUnitsStaleListingCount'],
    };
  },
};

/* ============================================================ */
/* 8. OPERATIONAL_ARBITRAGE — maintenance bundling (contractor) */
/* ============================================================ */

const maintenanceBundlingRule: ScanRule = {
  id: 'bundle_maintenance_tickets',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state) {
    const v = state.vendors?.maintenanceBundlingCandidates;
    if (!v) return false;
    return v.some((c) => c.pendingTicketCount >= 3 && c.mobilizationFee > 0);
  },
  evaluate(state) {
    const candidates = state.vendors!.maintenanceBundlingCandidates;
    const best = [...candidates]
      .filter((c) => c.pendingTicketCount >= 3)
      .sort((a, b) => b.mobilizationFee * b.pendingTicketCount - a.mobilizationFee * a.pendingTicketCount)[0]!;
    const savings = best.mobilizationFee * (best.pendingTicketCount - 1);
    return {
      id: 'bundle_maintenance_tickets',
      kind: 'operational_arbitrage',
      headline: {
        en: `Bundle ${best.pendingTicketCount} ${best.contractor} tickets — save ${best.mobilizationFee * (best.pendingTicketCount - 1)} in mobilization`,
        sw: `Unganisha tiketi ${best.pendingTicketCount} za ${best.contractor} — okoa gharama ya kuwasili mara nyingi`,
      },
      narrative: {
        en: `${best.contractor} has ${best.pendingTicketCount} pending tickets at separate sites. Bundling them into one visit eliminates ${best.pendingTicketCount - 1} mobilization fees.`,
        sw: `${best.contractor} ana tiketi ${best.pendingTicketCount} zinazosubiri katika maeneo tofauti. Kuziunganisha kwa ziara moja huondoa gharama ya kuwasili mara nyingi.`,
      },
      expectedValue: nonNegative(savings),
      savings: nonNegative(savings),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.78),
      timeWindowDays: 14,
      requiresActions: [
        {
          action: 'schedule_bundled_maintenance_visit',
          target: 'maintenance',
          payload: { contractor: best.contractor, tickets: best.pendingTicketCount },
        },
      ],
      relatedScopes: ['maintenance', 'vendors'],
      citations: ['vendors.maintenanceBundlingCandidates'],
    };
  },
};

/* ============================================================ */
/* 9. TAX_EFFICIENCY — property tax abatement application       */
/* ============================================================ */

const taxAbatementWindowRule: ScanRule = {
  id: 'tax_abatement_application_window',
  kind: 'tax_efficiency',
  requiresAction: true,
  detect(state) {
    const t = state.tax;
    return Boolean(t?.taxAbatementWindowOpen && (t.estimatedAbatementSavings ?? 0) > 0);
  },
  evaluate(state) {
    const t = state.tax!;
    const days = t.taxAbatementDaysRemaining ?? 30;
    const savings = t.estimatedAbatementSavings ?? 0;
    return {
      id: 'tax_abatement_application_window',
      kind: 'tax_efficiency',
      headline: {
        en: `Tax-abatement window closes in ${days} days — apply now`,
        sw: `Dirisha la kupunguza kodi linafungwa baada ya siku ${days} — omba sasa`,
      },
      narrative: {
        en: `Property-tax abatement window is open with ${days} day(s) remaining. Eligible portfolios capture an estimated annual saving of ~${savings.toLocaleString()}.`,
        sw: `Dirisha la kupunguza kodi ya mali lipo wazi, siku ${days} zimebaki. Kampuni zinazostahili huokoa takriban ${savings.toLocaleString()} kwa mwaka.`,
      },
      expectedValue: nonNegative(savings),
      savings: nonNegative(savings),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.82),
      timeWindowDays: Math.max(1, days),
      requiresActions: [
        {
          action: 'draft_tax_abatement_application',
          target: 'tax',
          payload: { estimatedSavings: savings },
        },
      ],
      relatedScopes: ['tax', 'compliance'],
      citations: ['tax.taxAbatementWindowOpen', 'tax.estimatedAbatementSavings'],
    };
  },
};

/* ============================================================ */
/* 10. COST_SAVING — multi-property insurance bundling          */
/* ============================================================ */

const insuranceBundlingRule: ScanRule = {
  id: 'bundle_multi_property_insurance',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state) {
    const i = state.insurance;
    if (!i) return false;
    if (i.separatePoliciesCount < 3) return false;
    if (i.bundlingDiscountPct == null) return false;
    return i.bundlingDiscountPct > 0 && (i.currentAnnualPremium ?? 0) > 0;
  },
  evaluate(state) {
    const i = state.insurance!;
    const discountPct = i.bundlingDiscountPct ?? 0;
    const annualSavings = (i.currentAnnualPremium ?? 0) * (discountPct / 100);
    return {
      id: 'bundle_multi_property_insurance',
      kind: 'cost_saving',
      headline: {
        en: `Bundle ${i.separatePoliciesCount} property policies — ${discountPct.toFixed(0)}% multi-property discount`,
        sw: `Unganisha sera za bima ${i.separatePoliciesCount} — punguzo la asilimia ${discountPct.toFixed(0)} kwa kuziweka pamoja`,
      },
      narrative: {
        en: `${i.separatePoliciesCount} properties on separate policies. Consolidating them under a single multi-property policy captures the ${discountPct.toFixed(0)}% bundling discount.`,
        sw: `Mali ${i.separatePoliciesCount} ziko kwenye sera tofauti za bima. Kuziunganisha katika sera moja huokoa asilimia ${discountPct.toFixed(0)}.`,
      },
      expectedValue: nonNegative(annualSavings),
      savings: nonNegative(annualSavings),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.76),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'request_multi_property_insurance_quote',
          target: 'insurance',
          payload: { propertyCount: i.separatePoliciesCount },
        },
      ],
      relatedScopes: ['insurance'],
      citations: ['insurance.separatePoliciesCount', 'insurance.bundlingDiscountPct'],
    };
  },
};

/* ============================================================ */
/* 11. REVENUE — auto-debit collection-rate uplift              */
/* ============================================================ */

const autoDebitUpliftRule: ScanRule = {
  id: 'set_up_auto_debit_collection',
  kind: 'revenue',
  requiresAction: true,
  detect(state) {
    const o = state.ops;
    if (!o) return false;
    return (
      o.tenantsWithoutAutoDebitCount >= 5 &&
      (o.avgRentPerTenantForAutoDebit ?? 0) > 0
    );
  },
  evaluate(state) {
    const o = state.ops!;
    const count = o.tenantsWithoutAutoDebitCount;
    const avgRent = o.avgRentPerTenantForAutoDebit ?? 0;
    // ~3% collection-rate uplift × 12 months for those tenants
    const annualUplift = count * avgRent * 0.03 * 12;
    return {
      id: 'set_up_auto_debit_collection',
      kind: 'revenue',
      headline: {
        en: `Move ${count} tenants to auto-debit — ~3% collection-rate uplift`,
        sw: `Hamisha wapangaji ${count} kwa malipo ya kiotomatiki — ongezeko la ukusanyaji asilimia 3`,
      },
      narrative: {
        en: `${count} tenants pay manually. Each manual cycle costs reconciliation time and a 2-3% collection-rate slippage. Auto-debit captures both.`,
        sw: `Wapangaji ${count} hulipa mwenyewe. Kila mzunguko wa mwongozo unagharimu muda wa kuunganisha na hupunguza ukusanyaji kwa asilimia 2-3.`,
      },
      expectedValue: nonNegative(annualUplift),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.72),
      timeWindowDays: 45,
      requiresActions: [
        {
          action: 'open_auto_debit_signup_flow',
          target: 'payments',
          payload: { tenantsCount: count },
        },
      ],
      relatedScopes: ['payments', 'operations'],
      citations: ['ops.tenantsWithoutAutoDebitCount'],
    };
  },
};

/* ============================================================ */
/* 12. REGULATORY_WINDOW — section-21 notice optimum window     */
/* ============================================================ */

const section21OptimumRule: ScanRule = {
  id: 'section21_notice_optimum_window',
  kind: 'regulatory_window',
  requiresAction: true,
  detect(state) {
    const r = state.regulator;
    if (!r) return false;
    if (r.section21WindowOpensInDays == null) return false;
    return r.section21WindowOpensInDays <= 14 && r.section21OptimumNotices > 0;
  },
  evaluate(state) {
    const r = state.regulator!;
    const days = r.section21WindowOpensInDays ?? 14;
    const count = r.section21OptimumNotices;
    return {
      id: 'section21_notice_optimum_window',
      kind: 'regulatory_window',
      headline: {
        en: `Optimum Section-21 / 32 notice window opens in ${days} days for ${count} tenancies`,
        sw: `Dirisha bora la notisi ya Section-21/32 linafunguliwa baada ya siku ${days} kwa upangaji ${count}`,
      },
      narrative: {
        en: `${count} tenancies you have flagged for non-renewal land best when the notice fires in the ${days}-day window — minimises mandated relisting friction and maximises your turnaround budget.`,
        sw: `Upangaji ${count} uliotambulishwa kwa kutorudishwa unafanya vyema notisi ikitolewa katika dirisha la siku ${days} — hupunguza msuguano na huongeza bajeti ya kurudisha.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.72),
      timeWindowDays: Math.max(1, days),
      requiresActions: [
        {
          action: 'draft_section21_notice_batch',
          target: 'leases',
          payload: { tenancyCount: count },
        },
      ],
      relatedScopes: ['leases', 'compliance'],
      citations: ['regulator.section21WindowOpensInDays'],
    };
  },
};

/* ============================================================ */
/* 13. REGULATORY_WINDOW — service-charge audit recovery        */
/* ============================================================ */

const serviceChargeAuditRule: ScanRule = {
  id: 'service_charge_audit_recovery',
  kind: 'regulatory_window',
  requiresAction: true,
  detect(state) {
    const r = state.regulator;
    return (
      r != null &&
      r.serviceChargeAuditOverdueCount > 0 &&
      (r.estimatedServiceChargeRecovery ?? 0) > 0
    );
  },
  evaluate(state) {
    const r = state.regulator!;
    const recovery = r.estimatedServiceChargeRecovery ?? 0;
    return {
      id: 'service_charge_audit_recovery',
      kind: 'regulatory_window',
      headline: {
        en: `Service-charge audit overdue on ${r.serviceChargeAuditOverdueCount} properties — recover ~${recovery.toLocaleString()}`,
        sw: `Ukaguzi wa malipo ya huduma umechelewa kwa mali ${r.serviceChargeAuditOverdueCount} — rejesha takriban ${recovery.toLocaleString()}`,
      },
      narrative: {
        en: `Statutory service-charge audit is overdue on ${r.serviceChargeAuditOverdueCount} properties. Closing the audit unlocks claw-back of historically over-recovered amounts.`,
        sw: `Ukaguzi wa lazima wa malipo ya huduma umechelewa kwa mali ${r.serviceChargeAuditOverdueCount}. Kukamilisha kunafungua urejeshaji wa fedha zilizolipwa kupita kiasi.`,
      },
      expectedValue: nonNegative(recovery),
      savings: nonNegative(recovery),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.74),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'open_service_charge_audit_workflow',
          target: 'compliance',
          payload: { properties: r.serviceChargeAuditOverdueCount },
        },
      ],
      relatedScopes: ['compliance', 'service_charge'],
      citations: ['regulator.serviceChargeAuditOverdueCount'],
    };
  },
};

/* ============================================================ */
/* 14. COST_SAVING — energy efficiency retrofit rebate          */
/* ============================================================ */

const energyRetrofitRebateRule: ScanRule = {
  id: 'energy_efficiency_retrofit_rebate',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state) {
    const e = state.energy;
    return (
      e != null &&
      e.retrofitRebateEligibleUnits > 0 &&
      (e.perUnitRebateAmount ?? 0) > 0
    );
  },
  evaluate(state) {
    const e = state.energy!;
    const total = e.retrofitRebateEligibleUnits * (e.perUnitRebateAmount ?? 0);
    return {
      id: 'energy_efficiency_retrofit_rebate',
      kind: 'cost_saving',
      headline: {
        en: `Claim energy-efficiency rebate on ${e.retrofitRebateEligibleUnits} units — ~${total.toLocaleString()}`,
        sw: `Dai ruzuku ya ufanisi wa nishati kwa vyumba ${e.retrofitRebateEligibleUnits} — takriban ${total.toLocaleString()}`,
      },
      narrative: {
        en: `${e.retrofitRebateEligibleUnits} units qualify for the energy-efficiency rebate. Bundling the retrofit + rebate application captures ~${total.toLocaleString()} plus a long-term utility cost reduction.`,
        sw: `Vyumba ${e.retrofitRebateEligibleUnits} vinastahili ruzuku ya ufanisi wa nishati. Kuunganisha matengenezo na maombi ya ruzuku huokoa takriban ${total.toLocaleString()} na kupunguza gharama za muda mrefu.`,
      },
      expectedValue: nonNegative(total),
      savings: nonNegative(total),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.72),
      timeWindowDays: 120,
      requiresActions: [
        {
          action: 'draft_retrofit_rebate_application',
          target: 'energy',
          payload: { eligibleUnits: e.retrofitRebateEligibleUnits },
        },
      ],
      relatedScopes: ['energy', 'cost_saving'],
      citations: ['energy.retrofitRebateEligibleUnits', 'energy.perUnitRebateAmount'],
    };
  },
};

/* ============================================================ */
/* 15. ESTATE_PLANNING — co-tenancy concentration diversification */
/* ============================================================ */

const concentrationDiversificationRule: ScanRule = {
  id: 'diversify_tenant_concentration',
  kind: 'estate_planning',
  requiresAction: false,
  detect(state) {
    const e = state.estate;
    return e != null && e.topTenantRevenuePct != null && e.topTenantRevenuePct > 25;
  },
  evaluate(state) {
    const e = state.estate!;
    const pct = e.topTenantRevenuePct ?? 0;
    return {
      id: 'diversify_tenant_concentration',
      kind: 'estate_planning',
      headline: {
        en: `Top tenant carries ${pct.toFixed(1)}% of revenue — diversify`,
        sw: `Mpangaji wa juu anachukua asilimia ${pct.toFixed(1)} ya mapato — sambaza`,
      },
      narrative: {
        en: `Single-tenant concentration at ${pct.toFixed(1)}% of total revenue is a brittleness signal. Diversifying via two-three new corporate leases or sector splits halves the default-event impact.`,
        sw: `Mpangaji mmoja anaongoza kwa asilimia ${pct.toFixed(1)} ya mapato. Kuongeza wapangaji wa kampuni 2-3 wapya kunapunguza athari ya hatari kwa nusu.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
      timeWindowDays: 180,
      requiresActions: [
        {
          action: 'open_tenant_diversification_plan',
          target: 'leases',
          payload: { topTenantSharePct: pct },
        },
      ],
      relatedScopes: ['estate', 'risk'],
      citations: ['estate.topTenantRevenuePct'],
    };
  },
};

/* ============================================================ */
/* 16. TAX_EFFICIENCY — capex acceleration / deferral by tax year */
/* ============================================================ */

const capexTaxYearRule: ScanRule = {
  id: 'capex_tax_year_optimisation',
  kind: 'tax_efficiency',
  requiresAction: true,
  detect(state) {
    const t = state.tax;
    return Boolean(
      t?.capexTaxYearOptimumMonth &&
        (t.deferrableCapex ?? 0) > 0 &&
        (t.currentYearTaxableProfit ?? 0) > 0,
    );
  },
  evaluate(state) {
    const t = state.tax!;
    const capex = t.deferrableCapex ?? 0;
    const taxBenefit = capex * 0.3; // assume ~30% effective rate
    return {
      id: 'capex_tax_year_optimisation',
      kind: 'tax_efficiency',
      headline: {
        en: `Accelerate capex into this tax year — shield ~${taxBenefit.toLocaleString()}`,
        sw: `Tumia matumizi ya mtaji mwaka huu — kinga kodi takriban ${taxBenefit.toLocaleString()}`,
      },
      narrative: {
        en: `You have ${capex.toLocaleString()} of deferrable capex and are in a profit-positive tax window. Booking the spend before year-end shields ~${taxBenefit.toLocaleString()} of tax liability.`,
        sw: `Una ${capex.toLocaleString()} za matumizi yanayoweza kuhamishwa. Kuyatumia kabla ya mwisho wa mwaka hukinga takriban ${taxBenefit.toLocaleString()} ya kodi.`,
      },
      expectedValue: nonNegative(taxBenefit),
      savings: nonNegative(taxBenefit),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'draft_capex_acceleration_plan',
          target: 'tax',
          payload: { capex, estimatedShield: taxBenefit },
        },
      ],
      relatedScopes: ['tax', 'capital'],
      citations: ['tax.capexTaxYearOptimumMonth', 'tax.deferrableCapex'],
    };
  },
};

/* ============================================================ */
/* 17. REVENUE — sublet permission monetization                 */
/* ============================================================ */

const subletMonetizationRule: ScanRule = {
  id: 'sublet_permission_monetisation',
  kind: 'revenue',
  requiresAction: true,
  detect(state) {
    const s = state.sublet;
    return Boolean(
      s &&
        s.unitsWithSubletPotentialCount > 0 &&
        (s.estimatedSubletMonthlyFeePerUnit ?? 0) > 0,
    );
  },
  evaluate(state) {
    const s = state.sublet!;
    const monthly = s.unitsWithSubletPotentialCount * (s.estimatedSubletMonthlyFeePerUnit ?? 0);
    const annual = monthly * 12;
    return {
      id: 'sublet_permission_monetisation',
      kind: 'revenue',
      headline: {
        en: `Monetise sublet permissions on ${s.unitsWithSubletPotentialCount} units — ~${monthly.toLocaleString()}/mo`,
        sw: `Pata mapato kutoka ruhusa ya kupangisha-tena vyumba ${s.unitsWithSubletPotentialCount} — takriban ${monthly.toLocaleString()}/mwezi`,
      },
      narrative: {
        en: `${s.unitsWithSubletPotentialCount} units have tenants who would benefit from a sanctioned sublet path. Charging a small monthly permission fee captures recurring revenue without raising base rent.`,
        sw: `Vyumba ${s.unitsWithSubletPotentialCount} vina wapangaji wanaonufaika na ruhusa ya kupangisha-tena. Kutoza ada ndogo kwa mwezi huleta mapato bila kuongeza kodi ya msingi.`,
      },
      expectedValue: nonNegative(annual),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.66),
      timeWindowDays: 90,
      requiresActions: [
        {
          action: 'draft_sublet_permission_policy',
          target: 'leases',
          payload: { unitsCount: s.unitsWithSubletPotentialCount },
        },
      ],
      relatedScopes: ['leases', 'revenue'],
      citations: ['sublet.unitsWithSubletPotentialCount'],
    };
  },
};

/* ============================================================ */
/* 18. OPERATIONAL_ARBITRAGE — long-stay tenant retention discount */
/* ============================================================ */

const longStayRetentionRule: ScanRule = {
  id: 'long_stay_renegotiation_retention',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state) {
    const ls = state.longStay;
    return Boolean(
      ls &&
        ls.tenantsOver24mNotOnDiscountTierCount > 0 &&
        (ls.avgRetentionUpliftPerLease ?? 0) > 0,
    );
  },
  evaluate(state) {
    const ls = state.longStay!;
    const lease = ls.tenantsOver24mNotOnDiscountTierCount;
    const upliftPerLease = ls.avgRetentionUpliftPerLease ?? 0;
    const total = lease * upliftPerLease;
    return {
      id: 'long_stay_renegotiation_retention',
      kind: 'operational_arbitrage',
      headline: {
        en: `Move ${lease} long-stay tenants onto retention tier — ~${total.toLocaleString()} retained value`,
        sw: `Hamisha wapangaji ${lease} wa muda mrefu kwa ngazi ya kubaki — thamani ya takriban ${total.toLocaleString()}`,
      },
      narrative: {
        en: `${lease} tenants over 24 months haven't been moved onto your long-stay retention tier. A small renewal discount keeps them past the high-churn re-leasing event.`,
        sw: `Wapangaji ${lease} wamekaa zaidi ya miezi 24 lakini hawajawa katika ngazi ya kubaki. Punguzo dogo la kodi huwafanya wakae.`,
      },
      expectedValue: nonNegative(total),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'open_long_stay_renegotiation_kanban',
          target: 'leases',
          payload: { count: lease },
        },
      ],
      relatedScopes: ['leases', 'retention'],
      citations: ['longStay.tenantsOver24mNotOnDiscountTierCount'],
    };
  },
};

/* ============================================================ */
/* 19. REVENUE — off-market acquisition lead capture            */
/* ============================================================ */

const offMarketAcquisitionRule: ScanRule = {
  id: 'off_market_acquisition_lead',
  kind: 'revenue',
  requiresAction: true,
  detect(state) {
    return (state.market?.offMarketLeadsCount ?? 0) > 0;
  },
  evaluate(state) {
    const m = state.market!;
    const count = m.offMarketLeadsCount;
    return {
      id: 'off_market_acquisition_lead',
      kind: 'revenue',
      headline: {
        en: `${count} off-market acquisition lead${count === 1 ? '' : 's'} in inbox — engage now`,
        sw: `Una ${count} ofa ya nje ya soko — anza mazungumzo sasa`,
      },
      narrative: {
        en: `${count} neighbour / off-market lead${count === 1 ? '' : 's'} surfaced. Off-market deals typically trade 8-12% below open-market comps — high-yield acquisition signal.`,
        sw: `Una ${count} ofa kutoka nje ya soko. Hizi huwa chini ya soko la wazi kwa asilimia 8-12 — ishara nzuri ya kununua.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.6),
      timeWindowDays: 21,
      requiresActions: [
        {
          action: 'open_off_market_outreach_thread',
          target: 'acquisitions',
          payload: { leadCount: count },
        },
      ],
      relatedScopes: ['acquisitions', 'market'],
      citations: ['market.offMarketLeadsCount'],
    };
  },
};

/* ============================================================ */
/* 20. CAPITAL — refinance mortgage when rate dropped           */
/* ============================================================ */

const mortgageRefinanceRule: ScanRule = {
  id: 'refinance_mortgage_rate_drop',
  kind: 'capital',
  requiresAction: true,
  detect(state) {
    const c = state.capital;
    if (!c) return false;
    if (c.mortgageCurrentRatePct == null || c.mortgageMarketRatePct == null) return false;
    if ((c.mortgagePrincipal ?? 0) < 50_000_000) return false;
    return c.mortgageCurrentRatePct - c.mortgageMarketRatePct >= 1.5;
  },
  evaluate(state) {
    const c = state.capital!;
    const delta = (c.mortgageCurrentRatePct ?? 0) - (c.mortgageMarketRatePct ?? 0);
    const annualSave = (c.mortgagePrincipal ?? 0) * (delta / 100);
    return {
      id: 'refinance_mortgage_rate_drop',
      kind: 'capital',
      headline: {
        en: `Refinance ${((c.mortgagePrincipal ?? 0) / 1_000_000).toFixed(0)}M mortgage — market is ${delta.toFixed(1)}pts cheaper`,
        sw: `Punguza riba ya rehani ya milioni ${((c.mortgagePrincipal ?? 0) / 1_000_000).toFixed(0)} — soko liko rahisi kwa pointi ${delta.toFixed(1)}`,
      },
      narrative: {
        en: `Your mortgage carries ${(c.mortgageCurrentRatePct ?? 0).toFixed(1)}%; the current market for borrowers in your tier is ${(c.mortgageMarketRatePct ?? 0).toFixed(1)}%. Refinancing saves ~${annualSave.toLocaleString()}/yr.`,
        sw: `Rehani yako ina riba ya asilimia ${(c.mortgageCurrentRatePct ?? 0).toFixed(1)}; soko la sasa kwa wakopaji wa ngazi yako ni asilimia ${(c.mortgageMarketRatePct ?? 0).toFixed(1)}. Kupunguza huokoa ~${annualSave.toLocaleString()}/mwaka.`,
      },
      expectedValue: nonNegative(annualSave),
      savings: nonNegative(annualSave),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.78),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'draft_mortgage_refinance_request',
          target: 'banking',
          payload: { currentRate: c.mortgageCurrentRatePct, marketRate: c.mortgageMarketRatePct },
        },
      ],
      relatedScopes: ['capital', 'banking'],
      citations: ['capital.mortgageCurrentRatePct', 'capital.mortgageMarketRatePct'],
    };
  },
};

/* ============================================================ */
/* 21. CAPITAL — loan refinance (general commercial loan)       */
/* ============================================================ */

const loanRefinanceRule: ScanRule = {
  id: 'refinance_commercial_loan',
  kind: 'capital',
  requiresAction: true,
  detect(state) {
    const c = state.capital;
    if (!c) return false;
    if (c.currentLoanRatePct == null || c.tibBetterRatePct == null) return false;
    if ((c.loanBalance ?? 0) < 100_000_000) return false;
    return c.currentLoanRatePct - c.tibBetterRatePct >= 1.5;
  },
  evaluate(state) {
    const c = state.capital!;
    const delta = (c.currentLoanRatePct ?? 0) - (c.tibBetterRatePct ?? 0);
    const annualSave = (c.loanBalance ?? 0) * (delta / 100);
    return {
      id: 'refinance_commercial_loan',
      kind: 'capital',
      headline: {
        en: `Refinance ${((c.loanBalance ?? 0) / 1_000_000).toFixed(0)}M commercial loan — ${delta.toFixed(1)}pts cheaper`,
        sw: `Punguza mkopo wa biashara wa milioni ${((c.loanBalance ?? 0) / 1_000_000).toFixed(0)} — punguzo la pointi ${delta.toFixed(1)}`,
      },
      narrative: {
        en: `Your commercial loan is at ${(c.currentLoanRatePct ?? 0).toFixed(1)}%; the best available rate is ${(c.tibBetterRatePct ?? 0).toFixed(1)}%. Refinancing saves ~${annualSave.toLocaleString()}/yr.`,
        sw: `Mkopo wako wa biashara una riba ya asilimia ${(c.currentLoanRatePct ?? 0).toFixed(1)}; bora ipo asilimia ${(c.tibBetterRatePct ?? 0).toFixed(1)}. Kupunguza huokoa ~${annualSave.toLocaleString()}/mwaka.`,
      },
      expectedValue: nonNegative(annualSave),
      savings: nonNegative(annualSave),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.75),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'draft_loan_refinance_request',
          target: 'banking',
          payload: { currentRate: c.currentLoanRatePct, targetRate: c.tibBetterRatePct },
        },
      ],
      relatedScopes: ['capital', 'banking'],
      citations: ['capital.currentLoanRatePct', 'capital.tibBetterRatePct'],
    };
  },
};

/* ============================================================ */
/* 22. COMPLIANCE_SHORTCUT — insurance auto-renew shortcut      */
/* ============================================================ */

const insuranceAutoRenewShortcutRule: ScanRule = {
  id: 'compliance_insurance_auto_renew_shortcut',
  kind: 'compliance_shortcut',
  requiresAction: true,
  detect(state) {
    return Boolean(state.insurance?.policyDueWithin60d);
  },
  evaluate(state) {
    return {
      id: 'compliance_insurance_auto_renew_shortcut',
      kind: 'compliance_shortcut',
      headline: {
        en: 'Set insurance to auto-renew via platform reminder',
        sw: 'Weka bima irudiwe kiotomatiki kupitia ukumbusho wa mfumo',
      },
      narrative: {
        en: `Policy renewal lands within 60 days. The platform can set a 30-day-out reminder and pre-fetch broker quotes so renewal lands without a fire-drill. One-time setup.`,
        sw: `Bima inahitajika kurudiwa ndani ya siku 60. Mfumo unaweza kuweka ukumbusho wa siku 30 mapema na kuandaa ofa za broker.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.85),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'schedule_insurance_renewal_reminder',
          target: 'reminders',
          payload: { offsetDays: 30 },
        },
      ],
      relatedScopes: ['insurance', 'reminders'],
      citations: ['insurance.policyDueWithin60d'],
    };
  },
};

/* ============================================================ */
/* 23. ESTATE_PLANNING — overdue succession plan review         */
/* ============================================================ */

const successionOverdueRule: ScanRule = {
  id: 'succession_plan_review_overdue',
  kind: 'estate_planning',
  requiresAction: true,
  detect(state) {
    return (state.estate?.overdueSuccessionReviewCount ?? 0) > 0;
  },
  evaluate(state) {
    const overdue = state.estate?.overdueSuccessionReviewCount ?? 0;
    return {
      id: 'succession_plan_review_overdue',
      kind: 'estate_planning',
      headline: {
        en: `Refresh ${overdue} succession plan${overdue === 1 ? '' : 's'} — market favours a review`,
        sw: `Sasisha mipango ya urithi ${overdue} — soko linapendelea ukaguzi`,
      },
      narrative: {
        en: `${overdue} succession plan(s) past their next-review date. Current property valuations lock a clean estate baseline and reduce regulator scrutiny on future generational transfers.`,
        sw: `Mipango ya urithi ${overdue} imepitwa na tarehe ya ukaguzi. Tathmini ya sasa huweka msingi safi na hupunguza hatari ya ukaguzi siku za usoni.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
      timeWindowDays: 30,
      requiresActions: [
        {
          action: 'open_succession_review_flow',
          target: 'estate',
          payload: { overdueCount: overdue },
        },
      ],
      relatedScopes: ['estate', 'succession'],
      citations: ['estate.overdueSuccessionReviewCount'],
    };
  },
};

/* ============================================================ */
/* 24. ESTATE_PLANNING — holding-co formation                   */
/* ============================================================ */

const holdingCoFormationRule: ScanRule = {
  id: 'estate_holding_co_formation',
  kind: 'estate_planning',
  requiresAction: false,
  detect(state) {
    const e = state.estate;
    return e != null && e.subsidiaryCount >= 2 && e.holdingCoExists === false;
  },
  evaluate(state) {
    const e = state.estate!;
    return {
      id: 'estate_holding_co_formation',
      kind: 'estate_planning',
      headline: {
        en: `Form a holding company — ${e.subsidiaryCount} property entities without one`,
        sw: `Anzisha kampuni mama — una kampuni tanzu ${e.subsidiaryCount} bila moja`,
      },
      narrative: {
        en: `You operate ${e.subsidiaryCount} property entities without a holding company. A holding structure simplifies group-relief tax planning, intercompany sweeps, and succession.`,
        sw: `Una kampuni tanzu ${e.subsidiaryCount} bila kampuni mama. Mfumo wa kampuni mama hurahisisha kodi, mauzo ya ndani, na urithi.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.62),
      timeWindowDays: 90,
      requiresActions: [],
      relatedScopes: ['estate', 'tax'],
      citations: ['estate.subsidiaryCount', 'estate.holdingCoExists'],
    };
  },
};

/* ============================================================ */
/* 25. HR — apprenticeship subsidy claim                        */
/* ============================================================ */

const apprenticeshipSubsidyRule: ScanRule = {
  id: 'apprenticeship_subsidy_claim',
  kind: 'hr',
  requiresAction: true,
  detect(state) {
    const w = state.workforce;
    return Boolean(
      w &&
        w.apprenticeshipEligibleCount > 0 &&
        (w.vetaSubsidyPerApprentice ?? 0) > 0,
    );
  },
  evaluate(state) {
    const w = state.workforce!;
    const subsidy = w.apprenticeshipEligibleCount * (w.vetaSubsidyPerApprentice ?? 0);
    return {
      id: 'apprenticeship_subsidy_claim',
      kind: 'hr',
      headline: {
        en: `Claim apprenticeship subsidy for ${w.apprenticeshipEligibleCount} staff — ${subsidy.toLocaleString()}`,
        sw: `Dai ruzuku ya wanafunzi kwa wafanyikazi ${w.apprenticeshipEligibleCount} — ${subsidy.toLocaleString()}`,
      },
      narrative: {
        en: `${w.apprenticeshipEligibleCount} staff sit within the apprenticeship-subsidy eligibility window. Subsidy per apprentice is ${(w.vetaSubsidyPerApprentice ?? 0).toLocaleString()}; total potential: ${subsidy.toLocaleString()}.`,
        sw: `Wafanyikazi ${w.apprenticeshipEligibleCount} wanastahili ruzuku ya wanafunzi. Kila mmoja: ${(w.vetaSubsidyPerApprentice ?? 0).toLocaleString()}; jumla: ${subsidy.toLocaleString()}.`,
      },
      expectedValue: nonNegative(subsidy),
      savings: nonNegative(subsidy),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.82),
      timeWindowDays: 90,
      requiresActions: [
        {
          action: 'draft_apprenticeship_subsidy_application',
          target: 'workforce',
          payload: { eligibleCount: w.apprenticeshipEligibleCount },
        },
      ],
      relatedScopes: ['workforce', 'training'],
      citations: ['workforce.apprenticeshipEligibleCount'],
    };
  },
};

/* ============================================================ */
/* 26. COST_SAVING — batch staff certification renewal          */
/* ============================================================ */

const certBatchRenewalRule: ScanRule = {
  id: 'staff_cert_batch_renewal',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state) {
    const w = state.workforce;
    return Boolean(
      w && w.certExpiringIn60dCount >= 5 && (w.perCertFee ?? 0) > 0,
    );
  },
  evaluate(state) {
    const w = state.workforce!;
    const perCert = w.perCertFee ?? 0;
    const count = w.certExpiringIn60dCount;
    const fullCost = perCert * count;
    const batchedCost = fullCost * 0.7;
    const savings = fullCost - batchedCost;
    return {
      id: 'staff_cert_batch_renewal',
      kind: 'cost_saving',
      headline: {
        en: `Batch ${count} staff certs — save ~${savings.toLocaleString()}`,
        sw: `Unganisha vyeti vya wafanyikazi ${count} — okoa takriban ${savings.toLocaleString()}`,
      },
      narrative: {
        en: `${count} staff certifications expire within 60 days. Batch-renewing typically discounts the per-cert fee by ~30%.`,
        sw: `Vyeti vya wafanyikazi ${count} vinaisha ndani ya siku 60. Upyaisho wa kundi hupunguza ada kwa asilimia 30.`,
      },
      expectedValue: nonNegative(savings),
      savings: nonNegative(savings),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.83),
      timeWindowDays: 60,
      requiresActions: [
        {
          action: 'draft_cert_batch_renewal',
          target: 'workforce',
          payload: { count },
        },
      ],
      relatedScopes: ['workforce', 'compliance'],
      citations: ['workforce.certExpiringIn60dCount'],
    };
  },
};

/* ============================================================ */
/* 27. COST_SAVING — vendor consolidation discount              */
/* ============================================================ */

const vendorConsolidationRule: ScanRule = {
  id: 'vendor_consolidation_discount',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state) {
    return Boolean(
      state.vendors?.categoriesWithMultipleSuppliers.some(
        (c) => c.supplierCount >= 3 && c.annualSpend > 30_000_000,
      ),
    );
  },
  evaluate(state) {
    const cat = state.vendors!.categoriesWithMultipleSuppliers
      .filter((c) => c.supplierCount >= 3 && c.annualSpend > 30_000_000)
      .sort((a, b) => b.annualSpend - a.annualSpend)[0]!;
    const savings = cat.annualSpend * 0.07;
    return {
      id: 'vendor_consolidation_discount',
      kind: 'cost_saving',
      headline: {
        en: `Consolidate ${cat.category} suppliers — ${cat.supplierCount} → 1 unlocks volume discount`,
        sw: `Unganisha watoaji wa ${cat.category} — ${cat.supplierCount} kwenda 1 inafungua punguzo`,
      },
      narrative: {
        en: `You buy ${cat.category} from ${cat.supplierCount} suppliers (${cat.annualSpend.toLocaleString()}/yr). Consolidating typically lands a 5-10% discount. Estimated annual save: ${savings.toLocaleString()}.`,
        sw: `Unanunua ${cat.category} kutoka watoaji ${cat.supplierCount} (${cat.annualSpend.toLocaleString()}/mwaka). Kuunganisha huokoa asilimia 5-10. Akiba: ${savings.toLocaleString()}.`,
      },
      expectedValue: nonNegative(savings),
      savings: nonNegative(savings),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.7),
      timeWindowDays: 45,
      requiresActions: [
        {
          action: 'draft_supplier_rfp',
          target: 'procurement',
          payload: { category: cat.category },
        },
      ],
      relatedScopes: ['procurement'],
      citations: ['vendors.categoriesWithMultipleSuppliers'],
    };
  },
};

/* ============================================================ */
/* 28. COUNTERPARTY — new corporate counterparty premium offer  */
/* ============================================================ */

const corporateCounterpartyRule: ScanRule = {
  id: 'new_corporate_counterparty_premium',
  kind: 'counterparty',
  requiresAction: true,
  detect(state) {
    return Boolean(state.counterparties?.newCorporateLeasePremiumOpportunity);
  },
  evaluate(state) {
    const cp = state.counterparties!.newCorporateLeasePremiumOpportunity!;
    const m = state.market;
    const market = m?.portfolioAvgRentPerUnit ?? 0;
    const annualPremium = cp.unitsRequested * market * (cp.premiumOverMarketPct / 100) * 12;
    return {
      id: 'new_corporate_counterparty_premium',
      kind: 'counterparty',
      headline: {
        en: `${cp.counterpartyName} offers ${cp.premiumOverMarketPct.toFixed(1)}% premium on ${cp.unitsRequested} units`,
        sw: `${cp.counterpartyName} anatoa ziada ya asilimia ${cp.premiumOverMarketPct.toFixed(1)} kwa vyumba ${cp.unitsRequested}`,
      },
      narrative: {
        en: `${cp.counterpartyName} (corporate, KYC-clean) wants ${cp.unitsRequested} units at ${cp.premiumOverMarketPct.toFixed(1)}% above market. Annualised premium: ~${annualPremium.toLocaleString()}.`,
        sw: `${cp.counterpartyName} (kampuni iliyothibitishwa) anahitaji vyumba ${cp.unitsRequested} kwa asilimia ${cp.premiumOverMarketPct.toFixed(1)} juu ya soko. Mapato ya mwaka: ~${annualPremium.toLocaleString()}.`,
      },
      expectedValue: nonNegative(annualPremium),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.78),
      timeWindowDays: 21,
      requiresActions: [
        {
          action: 'invite_corporate_to_master_lease',
          target: 'leases',
          payload: { counterpartyId: cp.counterpartyId },
        },
      ],
      relatedScopes: ['counterparty', 'leases'],
      citations: ['counterparties.newCorporateLeasePremiumOpportunity'],
    };
  },
};

/* ============================================================ */
/* 29. MARKET_TIMING — energy solar/hybrid switch               */
/* ============================================================ */

const energySolarSwitchRule: ScanRule = {
  id: 'energy_solar_hybrid_switch',
  kind: 'cost_saving',
  requiresAction: true,
  detect(state) {
    const e = state.energy;
    if (!e || e.currentGridTariffPerKwh == null || e.solarHybridPerKwh == null) return false;
    if (e.monthlyKwhConsumption == null) return false;
    return (
      e.currentGridTariffPerKwh - e.solarHybridPerKwh > 100 &&
      e.monthlyKwhConsumption > 5000
    );
  },
  evaluate(state) {
    const e = state.energy!;
    const delta = (e.currentGridTariffPerKwh ?? 0) - (e.solarHybridPerKwh ?? 0);
    const monthly = delta * (e.monthlyKwhConsumption ?? 0);
    const annual = monthly * 12;
    return {
      id: 'energy_solar_hybrid_switch',
      kind: 'cost_saving',
      headline: {
        en: `Solar-hybrid saves ${delta.toFixed(0)}/kWh — ~${monthly.toLocaleString()}/mo`,
        sw: `Mfumo wa jua + dizeli huokoa ${delta.toFixed(0)}/kWh — ~${monthly.toLocaleString()}/mwezi`,
      },
      narrative: {
        en: `Your grid tariff is ${(e.currentGridTariffPerKwh ?? 0).toLocaleString()}/kWh; a bonded solar-hybrid lease lands at ${(e.solarHybridPerKwh ?? 0).toLocaleString()}/kWh. Net save: ~${monthly.toLocaleString()}/mo (~${annual.toLocaleString()}/yr).`,
        sw: `Bei ya gridi ni ${(e.currentGridTariffPerKwh ?? 0).toLocaleString()}/kWh; mfumo wa jua ni ${(e.solarHybridPerKwh ?? 0).toLocaleString()}/kWh. Akiba: ${monthly.toLocaleString()}/mwezi (~${annual.toLocaleString()}/mwaka).`,
      },
      expectedValue: nonNegative(annual),
      savings: nonNegative(monthly),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.72),
      timeWindowDays: 90,
      requiresActions: [
        {
          action: 'draft_solar_hybrid_rfp',
          target: 'energy',
          payload: { monthlyKwh: e.monthlyKwhConsumption },
        },
      ],
      relatedScopes: ['energy', 'cost_saving'],
      citations: ['energy.currentGridTariffPerKwh', 'energy.solarHybridPerKwh'],
    };
  },
};

/* ============================================================ */
/* 30. PEER_BEST_PRACTICE — top-quartile occupancy pattern      */
/* ============================================================ */

const peerBestPracticeRule: ScanRule = {
  id: 'peer_best_practice_unmatched',
  kind: 'peer_best_practice',
  requiresAction: false,
  detect(state) {
    const p = state.peer;
    if (!p) return false;
    return Boolean(
      p.p75Pattern &&
        p.tenantUsesP75Pattern === false &&
        (p.tenantOccupancyPercentile ?? 100) < 75,
    );
  },
  evaluate(state) {
    const p = state.peer!;
    return {
      id: 'peer_best_practice_unmatched',
      kind: 'peer_best_practice',
      headline: {
        en: `Adopt the ${p.p75Pattern} pattern — top-quartile peers use it`,
        sw: `Tumia muundo wa ${p.p75Pattern} — wenzio bora wanautumia`,
      },
      narrative: {
        en: `Top-quartile peers use the ${p.p75Pattern} pattern (e.g. predictive listing refresh + viewing-streak retention). You sit at the ${p.tenantOccupancyPercentile?.toFixed(0)}th percentile on occupancy. Adoption typically lifts occupancy 4-6% within a quarter.`,
        sw: `Wenzio bora wanatumia ${p.p75Pattern}. Wewe uko asilimia ${p.tenantOccupancyPercentile?.toFixed(0)}. Kufuata huu unaweza kuongeza upangaji asilimia 4-6 ndani ya robo.`,
      },
      expectedValue: null,
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.65),
      timeWindowDays: 90,
      requiresActions: [],
      relatedScopes: ['operations', 'peer'],
      citations: ['peer.p75Pattern', 'peer.tenantOccupancyPercentile'],
    };
  },
};

/* ============================================================ */
/* 31. CAPITAL — intercompany surplus routing to holding co     */
/* ============================================================ */

const intercompanyRoutingRule: ScanRule = {
  id: 'intercompany_surplus_routing',
  kind: 'capital',
  requiresAction: true,
  detect(state) {
    const e = state.estate;
    return Boolean(
      e &&
        e.holdingCoExists &&
        e.subsidiaryCount > 0 &&
        (e.intercompanySurplus ?? 0) > 50_000_000,
    );
  },
  evaluate(state) {
    const e = state.estate!;
    const surplus = e.intercompanySurplus ?? 0;
    const annualisedValue = surplus * 0.05;
    return {
      id: 'intercompany_surplus_routing',
      kind: 'capital',
      headline: {
        en: `Sweep subsidiary surplus to holding co — saves friction + tax`,
        sw: `Hamisha akiba ya kampuni tanzu kwenda kampuni mama — punguza msuguano na kodi`,
      },
      narrative: {
        en: `Subsidiary cash surplus is ${surplus.toLocaleString()}. Routing to the holding co under a documented intercompany loan + treasury-pool policy reduces in-country friction and opens group-relief deductions. Estimated annual benefit: ~${annualisedValue.toLocaleString()}.`,
        sw: `Akiba ya kampuni tanzu ni ${surplus.toLocaleString()}. Kuhamisha kwenda kampuni mama hupunguza msuguano na hufungua punguzo la kodi. Faida ya mwaka: ~${annualisedValue.toLocaleString()}.`,
      },
      expectedValue: nonNegative(annualisedValue),
      savings: nonNegative(annualisedValue),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.72),
      timeWindowDays: 30,
      requiresActions: [
        {
          action: 'draft_intercompany_sweep_memo',
          target: 'estate',
          payload: { surplus },
        },
      ],
      relatedScopes: ['estate', 'capital', 'tax'],
      citations: ['estate.intercompanySurplus'],
    };
  },
};

/* ============================================================ */
/* 32. REGULATORY_WINDOW — housing-authority amnesty window     */
/* ============================================================ */

const housingAmnestyRule: ScanRule = {
  id: 'housing_authority_amnesty_window',
  kind: 'regulatory_window',
  requiresAction: true,
  detect(state) {
    const r = state.regulator;
    return Boolean(r?.housingAmnestyWindowOpen && r?.tenantQualifiesForAmnesty);
  },
  evaluate(state) {
    const r = state.regulator!;
    const days = r.housingAmnestyDaysRemaining ?? 30;
    const penalty = r.estimatedPenaltyAvoided ?? 0;
    return {
      id: 'housing_authority_amnesty_window',
      kind: 'regulatory_window',
      headline: {
        en: `Housing authority amnesty window — ${days} day${days === 1 ? '' : 's'} left`,
        sw: `Dirisha la msamaha la mamlaka ya nyumba — siku ${days} zimebaki`,
      },
      narrative: {
        en: `Housing authority opened an amnesty window and your filings qualify. Submitting before close avoids ~${penalty.toLocaleString()} in penalties and restores standing.`,
        sw: `Mamlaka ya nyumba imefungua msamaha na mafaili yako yanastahili. Kuwasilisha kabla ya tarehe ya mwisho kunaepusha adhabu ya takriban ${penalty.toLocaleString()}.`,
      },
      expectedValue: nonNegative(penalty),
      savings: nonNegative(penalty),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.88),
      timeWindowDays: Math.max(1, days),
      requiresActions: [
        {
          action: 'draft_housing_amnesty_filing',
          target: 'housing_authority',
          payload: {},
        },
      ],
      relatedScopes: ['regulator', 'compliance'],
      citations: ['regulator.housingAmnestyWindowOpen', 'regulator.estimatedPenaltyAvoided'],
    };
  },
};

/* ============================================================ */
/* 33. OPERATIONAL_ARBITRAGE — accelerate move-out turnaround   */
/* ============================================================ */

const turnaroundAccelerationRule: ScanRule = {
  id: 'accelerate_move_out_turnaround',
  kind: 'operational_arbitrage',
  requiresAction: true,
  detect(state) {
    const o = state.ops;
    if (!o || o.avgMoveOutTurnaroundDays == null || o.turnaroundP25Days == null) return false;
    return o.avgMoveOutTurnaroundDays > o.turnaroundP25Days + 5;
  },
  evaluate(state) {
    const o = state.ops!;
    const gap = (o.avgMoveOutTurnaroundDays ?? 0) - (o.turnaroundP25Days ?? 0);
    // Rough revenue impact: each saved day per turnover unit
    const p = state.portfolio;
    const monthlyRentPerUnit =
      p?.totalRentRollMonthly != null
        ? p.totalRentRollMonthly / Math.max(p.occupiedUnits, 1)
        : null;
    const annualSavedRev =
      monthlyRentPerUnit != null
        ? monthlyRentPerUnit * (gap / 30) * 12 // approximate per unit annualised
        : null;
    return {
      id: 'accelerate_move_out_turnaround',
      kind: 'operational_arbitrage',
      headline: {
        en: `Move-out turnaround ${gap.toFixed(0)}d longer than peer P25`,
        sw: `Muda wa kurudisha nyumba ni siku ${gap.toFixed(0)} zaidi ya wenzio bora`,
      },
      narrative: {
        en: `Average move-out turnaround is ${(o.avgMoveOutTurnaroundDays ?? 0).toFixed(0)}d vs peer P25 of ${(o.turnaroundP25Days ?? 0).toFixed(0)}d. Each day saved on every turnover recoups rent and stops the carrying-cost bleed.`,
        sw: `Wastani wa muda wa kurudisha nyumba ni siku ${(o.avgMoveOutTurnaroundDays ?? 0).toFixed(0)} dhidi ya wenzio bora wa siku ${(o.turnaroundP25Days ?? 0).toFixed(0)}. Kila siku iliyokokolewa hupata kodi na hupunguza gharama.`,
      },
      ...(annualSavedRev != null ? { expectedValue: nonNegative(annualSavedRev) } : {}),
      currencyCode: pickCurrency(state),
      confidence: clampConfidence(0.68),
      timeWindowDays: 30,
      requiresActions: [
        {
          action: 'open_turnaround_acceleration_playbook',
          target: 'operations',
          payload: { gapDays: gap },
        },
      ],
      relatedScopes: ['operations', 'leases'],
      citations: ['ops.avgMoveOutTurnaroundDays', 'ops.turnaroundP25Days'],
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
  longVacantRefreshRule,
  maintenanceBundlingRule,
  taxAbatementWindowRule,
  insuranceBundlingRule,
  autoDebitUpliftRule,
  section21OptimumRule,
  serviceChargeAuditRule,
  energyRetrofitRebateRule,
  concentrationDiversificationRule,
  capexTaxYearRule,
  subletMonetizationRule,
  longStayRetentionRule,
  offMarketAcquisitionRule,
  mortgageRefinanceRule,
  loanRefinanceRule,
  insuranceAutoRenewShortcutRule,
  successionOverdueRule,
  holdingCoFormationRule,
  apprenticeshipSubsidyRule,
  certBatchRenewalRule,
  vendorConsolidationRule,
  corporateCounterpartyRule,
  energySolarSwitchRule,
  peerBestPracticeRule,
  intercompanyRoutingRule,
  housingAmnestyRule,
  turnaroundAccelerationRule,
]);

export const ALL_SCAN_RULES = SCAN_RULES;
