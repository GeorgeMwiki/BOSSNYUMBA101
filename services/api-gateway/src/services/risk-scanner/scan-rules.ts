/**
 * Risk scan rules — real-estate domain.
 */

import type { Risk, RiskRule, RiskScannerState } from './types.js';

function currency(state: RiskScannerState): string {
  return state.primaryCurrencyCode || 'TZS';
}

const arrearsSpikeRule: RiskRule = {
  id: 'arrears_over_60d_spike',
  kind: 'cash_flow',
  severity: 'high',
  defaultTimeToImpactDays: 30,
  detect(state) {
    return (state.arrearsOver60dPctOfMonthly ?? 0) > 15;
  },
  evaluate(state) {
    const pct = state.arrearsOver60dPctOfMonthly ?? 0;
    const exposure =
      state.monthlyRevenue != null
        ? state.monthlyRevenue * (pct / 100)
        : null;
    return {
      id: 'arrears_over_60d_spike',
      ruleId: 'arrears_over_60d_spike',
      kind: 'cash_flow',
      severity: 'high',
      headline: {
        en: `Arrears over 60 days are ${pct.toFixed(1)}% of monthly rent`,
        sw: `Madeni ya zaidi ya siku 60 ni asilimia ${pct.toFixed(1)} ya kodi ya mwezi`,
      },
      narrative: {
        en: `Arrears above 60 days now exceed 15% of monthly rent receipts. This signals near-term cash flow risk — chase the top accounts and consider payment plans.`,
        sw: `Madeni ya zaidi ya siku 60 sasa yanazidi asilimia 15 ya mapato ya kodi ya mwezi. Hii inaonyesha hatari ya fedha ya muda mfupi — fuatilia akaunti kuu na zingatia mipango ya malipo.`,
      },
      exposure,
      currencyCode: currency(state),
      timeToImpactDays: 30,
      mitigationActions: [
        {
          action: 'open_arrears_chase_workflow',
          target: 'arrears',
          payload: { pct },
          label: { en: 'Open arrears chase', sw: 'Fungua ufuatiliaji wa madeni' },
        },
      ],
      relatedScopes: ['arrears', 'cash_flow'],
      citations: ['arrears.over60dPct'],
    };
  },
};

const housingPermitExpiryRule: RiskRule = {
  id: 'housing_permit_expiry_30d',
  kind: 'regulatory',
  severity: 'critical',
  defaultTimeToImpactDays: 30,
  detect(state) {
    const d = state.housingPermitDaysToExpiry;
    return d != null && d >= 0 && d <= 30;
  },
  evaluate(state) {
    const days = state.housingPermitDaysToExpiry ?? 0;
    return {
      id: 'housing_permit_expiry_30d',
      ruleId: 'housing_permit_expiry_30d',
      kind: 'regulatory',
      severity: 'critical',
      headline: {
        en: `Housing permit expires in ${days} days`,
        sw: `Kibali cha makazi kinakwisha siku ${days}`,
      },
      narrative: {
        en: `The portfolio's housing permit expires within 30 days. Renewal lead time at the local housing board is typically 21 days — start now to avoid lapse.`,
        sw: `Kibali cha makazi cha portfolio kinakwisha ndani ya siku 30. Muda wa kawaida wa upyaisho katika bodi ya makazi ya eneo ni siku 21 — anza sasa ili kuepuka kumalizika.`,
      },
      exposure: null,
      currencyCode: currency(state),
      timeToImpactDays: days,
      mitigationActions: [
        {
          action: 'open_housing_permit_renewal',
          target: 'regulator',
          payload: { daysRemaining: days },
          label: { en: 'Renew permit', sw: 'Pyaisha kibali' },
        },
      ],
      relatedScopes: ['regulator', 'compliance'],
      citations: ['regulator.housingPermitDaysToExpiry'],
    };
  },
};

const maintenanceBacklogGrowingRule: RiskRule = {
  id: 'maintenance_backlog_3mo_growth',
  kind: 'operational',
  severity: 'high',
  defaultTimeToImpactDays: 14,
  detect(state) {
    return state.maintenanceBacklogMomMonthsUp >= 3;
  },
  evaluate(state) {
    return {
      id: 'maintenance_backlog_3mo_growth',
      ruleId: 'maintenance_backlog_3mo_growth',
      kind: 'operational',
      severity: 'high',
      headline: {
        en: 'Maintenance backlog has grown 3 months in a row',
        sw: 'Kazi za matengenezo zimeongezeka miezi 3 mfululizo',
      },
      narrative: {
        en: `The maintenance backlog has grown month-on-month for 3 consecutive months. This is a leading indicator of tenant churn and inspection failures — escalate to manager review.`,
        sw: `Kazi za matengenezo zimeongezeka mwezi baada ya mwezi kwa miezi 3 mfululizo. Hii ni dalili ya wapangaji kuondoka na kushindwa kwa ukaguzi — peleka kwa mkuu kwa mapitio.`,
      },
      exposure: null,
      currencyCode: currency(state),
      timeToImpactDays: 14,
      mitigationActions: [
        {
          action: 'escalate_maintenance_burn_down',
          target: 'maintenance',
          payload: { monthsUp: state.maintenanceBacklogMomMonthsUp },
          label: { en: 'Escalate to manager', sw: 'Peleka kwa mkuu' },
        },
      ],
      relatedScopes: ['maintenance', 'operations'],
      citations: ['ops.maintenanceBacklogMomMonthsUp'],
    };
  },
};

const contractExpiryNoRenewalRule: RiskRule = {
  id: 'contract_expiry_no_renewal_60d',
  kind: 'legal',
  severity: 'high',
  defaultTimeToImpactDays: 60,
  detect(state) {
    return state.top3ContractsExpiring60d.some(
      (c) => !c.hasRenewalInFlight && c.daysToExpiry <= 60,
    );
  },
  evaluate(state) {
    const flagged = state.top3ContractsExpiring60d.filter(
      (c) => !c.hasRenewalInFlight && c.daysToExpiry <= 60,
    );
    const first = flagged[0];
    const totalValue = flagged.reduce(
      (acc, c) => acc + (c.annualValue ?? 0),
      0,
    );
    const minDaysToExpiry = Math.min(...flagged.map((c) => c.daysToExpiry));
    return {
      id: 'contract_expiry_no_renewal_60d',
      ruleId: 'contract_expiry_no_renewal_60d',
      kind: 'legal',
      severity: 'high',
      headline: {
        en: `${flagged.length} contract(s) expire within 60 days with no renewal in flight`,
        sw: `Mikataba ${flagged.length} inamalizika ndani ya siku 60 bila upyaisho kuanzishwa`,
      },
      narrative: {
        en: `Top contract (${first?.counterpartyName ?? 'unknown'}) expires in ${first?.daysToExpiry ?? 0} days. No renewal letter has been sent. Initiate renewal or risk loss of recurring revenue.`,
        sw: `Mkataba mkuu (${first?.counterpartyName ?? 'haijulikani'}) unamalizika ndani ya siku ${first?.daysToExpiry ?? 0}. Hakuna barua ya upyaisho iliyotumwa. Anzisha upyaisho au hatari ya kupoteza mapato ya kawaida.`,
      },
      exposure: totalValue > 0 ? totalValue : null,
      currencyCode: currency(state),
      timeToImpactDays: minDaysToExpiry,
      mitigationActions: [
        {
          action: 'open_contract_renewal_drafter',
          target: 'contracts',
          payload: { contractCount: flagged.length },
          label: { en: 'Start renewals', sw: 'Anza upyaisho' },
        },
      ],
      relatedScopes: ['contracts', 'leases'],
      citations: ['legal.top3ContractsExpiring60d'],
    };
  },
};

const complaintsSpikeRule: RiskRule = {
  id: 'tenant_complaints_60d_spike',
  kind: 'reputational',
  severity: 'medium',
  defaultTimeToImpactDays: 30,
  detect(state) {
    return state.tenantComplaints60d >= 10;
  },
  evaluate(state) {
    return {
      id: 'tenant_complaints_60d_spike',
      ruleId: 'tenant_complaints_60d_spike',
      kind: 'reputational',
      severity: 'medium',
      headline: {
        en: `${state.tenantComplaints60d} tenant complaints in 60 days`,
        sw: `Malalamiko ${state.tenantComplaints60d} ya wapangaji katika siku 60`,
      },
      narrative: {
        en: `Tenant complaints exceed 10 in the last 60 days. Cluster by root cause and consider a portfolio-wide service-level review before churn hits.`,
        sw: `Malalamiko ya wapangaji yanazidi 10 katika siku 60 zilizopita. Yagawe kwa chanzo na zingatia mapitio ya kiwango cha huduma kabla ya wapangaji kuondoka.`,
      },
      exposure: null,
      currencyCode: currency(state),
      timeToImpactDays: 30,
      mitigationActions: [
        {
          action: 'open_complaint_cluster_view',
          target: 'complaints',
          payload: { count: state.tenantComplaints60d },
          label: { en: 'Cluster complaints', sw: 'Gawanya malalamiko' },
        },
      ],
      relatedScopes: ['complaints', 'reputational'],
      citations: ['reputational.tenantComplaints60d'],
    };
  },
};

export const RISK_RULES: ReadonlyArray<RiskRule> = Object.freeze([
  arrearsSpikeRule,
  housingPermitExpiryRule,
  maintenanceBacklogGrowingRule,
  contractExpiryNoRenewalRule,
  complaintsSpikeRule,
]);

export const ALL_RISK_RULES = RISK_RULES;
