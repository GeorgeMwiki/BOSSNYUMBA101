/**
 * Risk Scanner — typed rule catalog (33 rules) — real-estate domain.
 *
 * Mirrors opportunity-scanner but every rule LOOKS for THREATS. Each
 * rule is a pure function of `RiskScannerState`. The scanner module
 * computes state up-front, then iterates this catalog calling
 * `detect()` then `evaluate()` on the survivors.
 *
 * Severity / time-to-impact thresholds are conservative — meaningful
 * surfacing requires `severity >= high` OR `timeToImpactDays <= 14` OR
 * `exposureAmount > 10M`. Bilingual narratives keep the SW-first
 * contract.
 *
 * Symmetry rule with opportunity-scanner: risk wins urgency tie-breaker.
 */

import type {
  BilingualText,
  Risk,
  RiskRule,
  RiskScannerState,
} from './types.js';

function bilingual(en: string, sw: string): BilingualText {
  return { en, sw };
}

function currencyOf(s: RiskScannerState): string {
  return s.primaryCurrencyCode || 'TZS';
}

const MIT_OPEN_WIZARD = bilingual('Open mitigation wizard', 'Fungua mchawi wa kupunguza');
const MIT_DRAFT_RENEWAL = bilingual('Draft renewal now', 'Andika upyaji sasa');
const MIT_SCHEDULE_REVIEW = bilingual('Schedule review', 'Panga ukaguzi');
const MIT_NOTIFY_LEGAL = bilingual('Notify legal team', 'Mjulishe timu ya kisheria');
const MIT_OPEN_COLLECTIONS = bilingual('Open collections workflow', 'Fungua mtiririko wa ukusanyaji');

const cashRunwayBelow90d: RiskRule = {
  id: 'cash.runway_below_90d',
  kind: 'cash_flow',
  severity: 'high',
  defaultTimeToImpactDays: 90,
  detect(s) { return s.cashRunwayDays !== null && s.cashRunwayDays < 90; },
  evaluate(s) {
    const days = s.cashRunwayDays ?? 90;
    const sev = days < 30 ? 'critical' : days < 60 ? 'high' : 'medium';
    return {
      id: 'cash.runway_below_90d', kind: 'cash_flow', severity: sev,
      headline: bilingual(`Cash runway is ${days} days`, `Mtiririko wa fedha ni siku ${days}`),
      narrative: bilingual(
        `At the current burn rate the operation runs out of cash in ${days} days. Trigger a treasury review and pull forward rent collections before the gap widens.`,
        `Kwa kiwango cha sasa cha matumizi, biashara itaishiwa fedha katika siku ${days}. Anzisha ukaguzi wa hazina na uharakishe ukusanyaji wa kodi.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [
        { action: 'open_treasury_review', label: MIT_SCHEDULE_REVIEW },
        { action: 'accelerate_rent_collection', label: MIT_OPEN_COLLECTIONS },
      ],
      relatedScopes: [], citations: ['bossnyumba:cash-runway'], ruleId: 'cash.runway_below_90d',
    };
  },
};

const cashArAgingCritical: RiskRule = {
  id: 'cash.ar_aging_critical', kind: 'cash_flow', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.arOverdue60dPctOfMonthly !== null && s.arOverdue60dPctOfMonthly > 15; },
  evaluate(s) {
    const pct = Math.round(s.arOverdue60dPctOfMonthly ?? 0);
    const sev = pct > 30 ? 'high' : 'medium';
    return {
      id: 'cash.ar_aging_critical', kind: 'cash_flow', severity: sev,
      headline: bilingual(`${pct}% of revenue overdue 60+ days`, `${pct}% ya mapato yamechelewa siku 60+`),
      narrative: bilingual(
        `Receivables aged 60+ days are running at ${pct}% of monthly revenue. Push collection or this becomes a write-down at month-end.`,
        `Madeni ya zaidi ya siku 60 yamefika ${pct}% ya mapato ya mwezi. Sukuma ukusanyaji vinginevyo itakuwa hasara.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_collections_workflow', label: MIT_OPEN_COLLECTIONS }],
      relatedScopes: [], citations: ['bossnyumba:ar-aging'], ruleId: 'cash.ar_aging_critical',
    };
  },
};

const cashPayrollAtRisk: RiskRule = {
  id: 'cash.payroll_at_risk', kind: 'cash_flow', severity: 'high', defaultTimeToImpactDays: 7,
  detect(s) {
    return s.payrollDueInDays !== null && s.payrollDueInDays <= 7 &&
      s.cashOnHand !== null && s.payrollAmount !== null && s.cashOnHand < s.payrollAmount * 1.2;
  },
  evaluate(s) {
    const days = s.payrollDueInDays ?? 7;
    return {
      id: 'cash.payroll_at_risk', kind: 'cash_flow', severity: days <= 3 ? 'critical' : 'high',
      headline: bilingual(
        `Payroll due in ${days} day${days === 1 ? '' : 's'} with thin cash buffer`,
        `Mishahara inalipwa katika siku ${days} bila buffer ya kutosha`),
      narrative: bilingual(
        `Cash on hand only thinly covers next payroll. Trigger a bridge: accelerated rent collection or short-term credit line.`,
        `Pesa zilizopo zinazingira tu mshahara unaofuata. Anzisha daraja: ukusanyaji wa haraka au mkopo wa muda mfupi.`),
      exposureAmount: s.payrollAmount, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [{ action: 'open_payroll_bridge_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:payroll'], ruleId: 'cash.payroll_at_risk',
    };
  },
};

const mortgagePaymentRisk: RiskRule = {
  id: 'cash.mortgage_payment_risk', kind: 'cash_flow', severity: 'high', defaultTimeToImpactDays: 14,
  detect(s) {
    return s.mortgagePaymentDueInDays !== null && s.mortgagePaymentDueInDays <= 14 &&
      s.cashOnHand !== null && s.mortgagePaymentAmount !== null && s.cashOnHand < s.mortgagePaymentAmount * 1.1;
  },
  evaluate(s) {
    const days = s.mortgagePaymentDueInDays ?? 14;
    return {
      id: 'cash.mortgage_payment_risk', kind: 'cash_flow', severity: days <= 5 ? 'critical' : 'high',
      headline: bilingual(
        `Mortgage payment due in ${days} day${days === 1 ? '' : 's'} — cash buffer thin`,
        `Malipo ya rehani katika siku ${days} — buffer ndogo`),
      narrative: bilingual(
        `Mortgage installment lands within ${days} days; cash buffer covers only the payment. Missed payment damages credit score.`,
        `Awamu ya rehani inalipwa siku ${days}; pesa zilizopo zinakidhi tu. Kuruka huharibu alama ya mkopo.`),
      exposureAmount: s.mortgagePaymentAmount, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [{ action: 'open_mortgage_bridge_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:mortgage'], ruleId: 'cash.mortgage_payment_risk',
    };
  },
};

const tenantsArrears30dPlus: RiskRule = {
  id: 'arrears.tenants_30d_plus', kind: 'cash_flow', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.rentArrears30dCount > 0; },
  evaluate(s) {
    const c30 = s.rentArrears30dCount;
    const c60 = s.rentArrears60dCount;
    const c90 = s.rentArrears90dCount;
    const sev = c90 > 0 ? 'high' : c60 > 0 ? 'medium' : 'low';
    return {
      id: 'arrears.tenants_30d_plus', kind: 'cash_flow', severity: sev,
      headline: bilingual(
        `${c30} tenant${c30 === 1 ? '' : 's'} 30+ days in arrears (${c60} at 60d, ${c90} at 90d)`,
        `Wapangaji ${c30} wamechelewa kodi siku 30+ (${c60} siku 60, ${c90} siku 90)`),
      narrative: bilingual(
        `Total arrears ladder: 30d → ${c30}, 60d → ${c60}, 90d → ${c90}. Drive 60d+ to collections before write-down.`,
        `Mlolongo wa madeni: 30d → ${c30}, 60d → ${c60}, 90d → ${c90}. Wapeleke wa siku 60+ kwa ukusanyaji.`),
      exposureAmount: s.rentArrearsTotalAmount, currencyCode: currencyOf(s),
      timeToImpactDays: c90 > 0 ? 14 : 30,
      mitigationActions: [{ action: 'open_arrears_kanban', label: MIT_OPEN_COLLECTIONS }],
      relatedScopes: [], citations: ['bossnyumba:arrears'], ruleId: 'arrears.tenants_30d_plus',
    };
  },
};

const insuranceCertExpiring: RiskRule = {
  id: 'regulatory.insurance_cert_expiring', kind: 'regulatory', severity: 'high', defaultTimeToImpactDays: 30,
  detect(s) { return s.insuranceCertDaysToExpiry !== null && s.insuranceCertDaysToExpiry <= 30; },
  evaluate(s) {
    const days = s.insuranceCertDaysToExpiry ?? 30;
    return {
      id: 'regulatory.insurance_cert_expiring', kind: 'regulatory', severity: days <= 7 ? 'critical' : 'high',
      headline: bilingual(`Insurance certificate expires in ${days} day${days === 1 ? '' : 's'}`,
        `Cheti cha bima kinaisha siku ${days}`),
      narrative: bilingual(
        `Mandatory insurance cert lapses in ${days} days. Without renewal, leases are technically uncovered and an incident triggers full liability.`,
        `Cheti cha bima cha lazima kinaisha siku ${days}. Bila upyaisho, ajali itasababisha dhima kamili.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [
        { action: 'draft_insurance_renewal', label: MIT_DRAFT_RENEWAL },
        { action: 'schedule_review', target: 'this_week', label: MIT_SCHEDULE_REVIEW },
      ],
      relatedScopes: [], citations: ['bossnyumba:insurance-cert'], ruleId: 'regulatory.insurance_cert_expiring',
    };
  },
};

const fireSafetyCertExpiring: RiskRule = {
  id: 'regulatory.fire_safety_cert_expiring', kind: 'regulatory', severity: 'high', defaultTimeToImpactDays: 30,
  detect(s) { return s.fireSafetyCertDaysToExpiry !== null && s.fireSafetyCertDaysToExpiry <= 30; },
  evaluate(s) {
    const days = s.fireSafetyCertDaysToExpiry ?? 30;
    return {
      id: 'regulatory.fire_safety_cert_expiring', kind: 'regulatory', severity: days <= 7 ? 'critical' : 'high',
      headline: bilingual(`Fire-safety certificate expires in ${days} day${days === 1 ? '' : 's'}`,
        `Cheti cha usalama wa moto kinaisha siku ${days}`),
      narrative: bilingual(
        `Statutory fire-safety cert renewal must complete before lapse — operating without it triggers fines and tenant claims.`,
        `Upyaisho wa cheti cha usalama wa moto lazima ufanyike kabla ya kuisha.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [{ action: 'draft_fire_safety_renewal', label: MIT_DRAFT_RENEWAL }],
      relatedScopes: [], citations: ['bossnyumba:fire-safety-cert'], ruleId: 'regulatory.fire_safety_cert_expiring',
    };
  },
};

const gasSafetyCertExpiring: RiskRule = {
  id: 'regulatory.gas_safety_cert_expiring', kind: 'regulatory', severity: 'high', defaultTimeToImpactDays: 30,
  detect(s) { return s.gasSafetyCertDaysToExpiry !== null && s.gasSafetyCertDaysToExpiry <= 30; },
  evaluate(s) {
    const days = s.gasSafetyCertDaysToExpiry ?? 30;
    return {
      id: 'regulatory.gas_safety_cert_expiring', kind: 'regulatory', severity: days <= 7 ? 'critical' : 'high',
      headline: bilingual(`Gas-safety certificate expires in ${days} day${days === 1 ? '' : 's'}`,
        `Cheti cha usalama wa gesi kinaisha siku ${days}`),
      narrative: bilingual(
        `Annual gas-safety renewal is statutory. A lapse exposes the landlord to manslaughter liability if an incident occurs.`,
        `Upyaisho wa cheti cha gesi ni lazima kila mwaka. Kuisha kunaweka mmiliki kwa hatari kubwa ya kisheria.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [{ action: 'draft_gas_safety_renewal', label: MIT_DRAFT_RENEWAL }],
      relatedScopes: [], citations: ['bossnyumba:gas-safety-cert'], ruleId: 'regulatory.gas_safety_cert_expiring',
    };
  },
};

const housingFilingOverdue: RiskRule = {
  id: 'regulatory.housing_filing_overdue', kind: 'regulatory', severity: 'high', defaultTimeToImpactDays: 14,
  detect(s) { return s.housingFilingDaysOverdue !== null && s.housingFilingDaysOverdue > 0; },
  evaluate(s) {
    const days = s.housingFilingDaysOverdue ?? 0;
    return {
      id: 'regulatory.housing_filing_overdue', kind: 'regulatory', severity: days > 30 ? 'critical' : 'high',
      headline: bilingual(`Housing-authority filing overdue ${days} day${days === 1 ? '' : 's'}`,
        `Kuwasilisha mamlaka ya nyumba kumechelewa siku ${days}`),
      narrative: bilingual(
        `Statutory housing-authority filing is ${days} days overdue. Penalty accrual is active.`,
        `Kuwasilisha kumechelewa siku ${days}. Adhabu inakua.`),
      exposureAmount: s.housingPenaltyAccrual, currencyCode: currencyOf(s), timeToImpactDays: 1,
      mitigationActions: [{ action: 'open_housing_filing_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:housing-filing'], ruleId: 'regulatory.housing_filing_overdue',
    };
  },
};

const regulatorInspectionDue: RiskRule = {
  id: 'regulatory.inspection_due', kind: 'regulatory', severity: 'medium', defaultTimeToImpactDays: 21,
  detect(s) { return s.regulatorInspectionDueInDays !== null && s.regulatorInspectionDueInDays <= 21; },
  evaluate(s) {
    const days = s.regulatorInspectionDueInDays ?? 21;
    return {
      id: 'regulatory.inspection_due', kind: 'regulatory', severity: days <= 7 ? 'high' : 'medium',
      headline: bilingual(`Regulator inspection due in ${days} days`, `Ukaguzi wa mamlaka baada ya siku ${days}`),
      narrative: bilingual(
        `Scheduled regulator inspection lands in ${days} days. Pre-clear the punch-list now.`,
        `Ukaguzi umepangwa baada ya siku ${days}. Tatua mapema.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [{ action: 'open_pre_inspection_punchlist', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:regulator-inspection'], ruleId: 'regulatory.inspection_due',
    };
  },
};

const propertyTaxOverdue: RiskRule = {
  id: 'tax.property_tax_overdue', kind: 'tax', severity: 'high', defaultTimeToImpactDays: 14,
  detect(s) { return s.propertyTaxDaysOverdue !== null && s.propertyTaxDaysOverdue > 0; },
  evaluate(s) {
    const days = s.propertyTaxDaysOverdue ?? 0;
    return {
      id: 'tax.property_tax_overdue', kind: 'tax', severity: days > 30 ? 'critical' : 'high',
      headline: bilingual(`Property tax overdue ${days} day${days === 1 ? '' : 's'}`, `Kodi ya mali imechelewa siku ${days}`),
      narrative: bilingual(
        `Property tax payment is ${days} days overdue. Penalty interest accrues daily.`,
        `Malipo ya kodi yamechelewa siku ${days}. Riba inakua.`),
      exposureAmount: s.propertyTaxAccruedAmount, currencyCode: currencyOf(s), timeToImpactDays: 1,
      mitigationActions: [{ action: 'open_property_tax_payment', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:property-tax'], ruleId: 'tax.property_tax_overdue',
    };
  },
};

const hoaDuesOverdue: RiskRule = {
  id: 'estate.hoa_dues_overdue', kind: 'estate', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.hoaDuesDaysOverdue !== null && s.hoaDuesDaysOverdue > 0; },
  evaluate(s) {
    const days = s.hoaDuesDaysOverdue ?? 0;
    return {
      id: 'estate.hoa_dues_overdue', kind: 'estate', severity: days > 60 ? 'high' : 'medium',
      headline: bilingual(`HOA / association dues overdue ${days} day${days === 1 ? '' : 's'}`,
        `Ada ya jumuiya imechelewa siku ${days}`),
      narrative: bilingual(
        `Housing association dues are ${days} days overdue. Late dues trigger penalties and may block service access.`,
        `Ada ya jumuiya imechelewa siku ${days}. Hii husababisha faini na kuzuia huduma.`),
      exposureAmount: s.hoaDuesOverdueAmount, currencyCode: currencyOf(s), timeToImpactDays: 14,
      mitigationActions: [{ action: 'open_hoa_payment', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:hoa-dues'], ruleId: 'estate.hoa_dues_overdue',
    };
  },
};

const maintenanceOverSla: RiskRule = {
  id: 'operational.maintenance_over_sla', kind: 'operational', severity: 'medium', defaultTimeToImpactDays: 7,
  detect(s) { return s.maintenanceTicketsOverSlaCount > 0; },
  evaluate(s) {
    const count = s.maintenanceTicketsOverSlaCount;
    const sev = s.maintenanceTicketsOverSla7dCount > 5 ? 'high' : 'medium';
    return {
      id: 'operational.maintenance_over_sla', kind: 'operational', severity: sev,
      headline: bilingual(`${count} maintenance ticket${count === 1 ? '' : 's'} over SLA`,
        `Tiketi za matengenezo ${count} zaidi ya SLA`),
      narrative: bilingual(
        `${count} open tickets exceed SLA — tenant satisfaction degrades and churn risk rises after 14 days uncompleted.`,
        `Tiketi ${count} zimepita SLA — kuridhika kwa wapangaji kunashuka.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 7,
      mitigationActions: [{ action: 'open_sla_burn_down_board', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:maintenance-sla'], ruleId: 'operational.maintenance_over_sla',
    };
  },
};

const contractorRepeatNonPerformance: RiskRule = {
  id: 'operational.contractor_repeat_non_performance', kind: 'operational', severity: 'medium', defaultTimeToImpactDays: 14,
  detect(s) { return s.contractorRepeatNonPerformances.length > 0; },
  evaluate(s) {
    const c = s.contractorRepeatNonPerformances[0]!;
    return {
      id: 'operational.contractor_repeat_non_performance', kind: 'operational',
      severity: c.failureCount >= 3 ? 'high' : 'medium',
      headline: bilingual(`${c.contractor} repeat non-performance ${c.failureCount}× in ${c.windowDays}d`,
        `${c.contractor} amekosa kazi mara ${c.failureCount} ndani ya siku ${c.windowDays}`),
      narrative: bilingual(
        `Contractor ${c.contractor} missed/failed ${c.failureCount} jobs in the last ${c.windowDays} days. Source a backup.`,
        `Mkandarasi ${c.contractor} amekosa kazi mara ${c.failureCount}. Tafuta mbadala.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 14,
      mitigationActions: [{ action: 'open_contractor_remediation_plan', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:contractor-performance'],
      ruleId: 'operational.contractor_repeat_non_performance',
    };
  },
};

const leaseExpiryWithoutRenewal: RiskRule = {
  id: 'legal.lease_expiry_without_renewal', kind: 'legal', severity: 'medium', defaultTimeToImpactDays: 45,
  detect(s) { return s.leaseExpiryWithoutRenewalCount > 0; },
  evaluate(s) {
    const count = s.leaseExpiryWithoutRenewalCount;
    const days = s.leaseExpiryWithoutRenewalAverageDaysOut ?? 45;
    return {
      id: 'legal.lease_expiry_without_renewal', kind: 'legal', severity: days <= 14 ? 'high' : 'medium',
      headline: bilingual(`${count} lease${count === 1 ? '' : 's'} expire avg ${days}d with no renewal signal`,
        `Mikataba ${count} inamalizika ndani ya siku ${days} bila upyaisho`),
      narrative: bilingual(
        `${count} leases expire on average in ${days} days without active renewal intent. Each unrenewed lease becomes a vacancy.`,
        `Mikataba ${count} inamalizika siku ${days} bila kuonyesha nia. Hii husababisha nafasi wazi.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [{ action: 'open_renewal_outreach_kanban', label: MIT_DRAFT_RENEWAL }],
      relatedScopes: [], citations: ['bossnyumba:lease-expiry'], ruleId: 'legal.lease_expiry_without_renewal',
    };
  },
};

const evictionDeadlineRisk: RiskRule = {
  id: 'legal.eviction_deadline_risk', kind: 'legal', severity: 'high', defaultTimeToImpactDays: 7,
  detect(s) {
    return s.evictionNoticeDeadlineRiskCount > 0 &&
      s.evictionDeadlineWithinDays !== null && s.evictionDeadlineWithinDays <= 14;
  },
  evaluate(s) {
    const days = s.evictionDeadlineWithinDays ?? 7;
    const count = s.evictionNoticeDeadlineRiskCount;
    return {
      id: 'legal.eviction_deadline_risk', kind: 'legal', severity: days <= 3 ? 'critical' : 'high',
      headline: bilingual(
        `Eviction-notice deadline in ${days} day${days === 1 ? '' : 's'} for ${count} tenanc${count === 1 ? 'y' : 'ies'}`,
        `Mwisho wa notisi ya kufukuza ni siku ${days} kwa upangaji ${count}`),
      narrative: bilingual(
        `${count} eviction-notice deadlines hit within ${days} days. Missing a statutory deadline collapses the case.`,
        `Mwisho wa notisi ${count} unafika siku ${days}. Kukosa unalazimisha kuanzia upya.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: days,
      mitigationActions: [
        { action: 'notify_legal_team', label: MIT_NOTIFY_LEGAL },
        { action: 'open_eviction_filing_wizard', label: MIT_OPEN_WIZARD },
      ],
      relatedScopes: [], citations: ['bossnyumba:eviction-deadline'], ruleId: 'legal.eviction_deadline_risk',
    };
  },
};

const staffAttritionSpike: RiskRule = {
  id: 'hr.staff_attrition_spike', kind: 'hr', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.staffAttrition90d >= 3; },
  evaluate(s) {
    const count = s.staffAttrition90d;
    return {
      id: 'hr.staff_attrition_spike', kind: 'hr', severity: count >= 5 ? 'high' : 'medium',
      headline: bilingual(`Staff attrition spike — ${count} departures in 90d`,
        `Ongezeko la wafanyikazi kuondoka — ${count} ndani ya siku 90`),
      narrative: bilingual(
        `${count} staff have left in the last 90 days. Hand-offs degrade service quality.`,
        `Wafanyikazi ${count} wameondoka. Uondoaji unaathiri huduma.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_retention_review', label: MIT_SCHEDULE_REVIEW }],
      relatedScopes: [], citations: ['bossnyumba:hr-attrition'], ruleId: 'hr.staff_attrition_spike',
    };
  },
};

const staffCertsExpired: RiskRule = {
  id: 'hr.staff_certs_expired', kind: 'hr', severity: 'medium', defaultTimeToImpactDays: 21,
  detect(s) { return s.staffCertsExpiredActive > 0; },
  evaluate(s) {
    const count = s.staffCertsExpiredActive;
    return {
      id: 'hr.staff_certs_expired', kind: 'hr', severity: count >= 5 ? 'high' : 'medium',
      headline: bilingual(`${count} active staff${count === 1 ? '' : ' members'} hold expired certs`,
        `Wafanyikazi ${count} wana vyeti vilivyokwisha`),
      narrative: bilingual(
        `${count} active staff certifications are expired. Compliance penalties and individual liability stack until renewal.`,
        `Vyeti vya wafanyikazi ${count} vimekwisha. Adhabu zinaongezeka.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 21,
      mitigationActions: [{ action: 'open_cert_renewal_batch', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:hr-certs'], ruleId: 'hr.staff_certs_expired',
    };
  },
};

const housingComplianceAmber: RiskRule = {
  id: 'compliance.housing_amber', kind: 'compliance', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.housingCompliancePoliciesAmber; },
  evaluate(s) {
    return {
      id: 'compliance.housing_amber', kind: 'compliance', severity: 'medium',
      headline: bilingual(`Housing compliance status: amber`, `Hali ya kufuata sheria za nyumba: njano`),
      narrative: bilingual(
        `Compliance dashboard flagged amber on housing policy posture. Audit before the regulator notices.`,
        `Dashibodi ya kufuata sheria imeonyesha njano. Fanya ukaguzi.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_compliance_audit_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:compliance-housing'], ruleId: 'compliance.housing_amber',
    };
  },
};

const safetyComplianceAmber: RiskRule = {
  id: 'compliance.safety_amber', kind: 'compliance', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.safetyCompliancePoliciesAmber; },
  evaluate(s) {
    return {
      id: 'compliance.safety_amber', kind: 'compliance', severity: 'medium',
      headline: bilingual(`Safety compliance status: amber`, `Hali ya kufuata usalama: njano`),
      narrative: bilingual(
        `Safety-policy posture flagged amber. Run a walkthrough audit before an incident exposes the gap.`,
        `Sera za usalama zimeonyesha njano. Fanya ukaguzi.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_safety_audit_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:compliance-safety'], ruleId: 'compliance.safety_amber',
    };
  },
};

const openIncidentsRisk: RiskRule = {
  id: 'operational.open_incidents', kind: 'operational', severity: 'medium', defaultTimeToImpactDays: 14,
  detect(s) { return s.openIncidents > 0; },
  evaluate(s) {
    const count = s.openIncidents;
    return {
      id: 'operational.open_incidents', kind: 'operational', severity: count >= 3 ? 'high' : 'medium',
      headline: bilingual(`${count} open incident${count === 1 ? '' : 's'} unresolved`,
        `Matukio ${count} hayajatatuliwa`),
      narrative: bilingual(
        `${count} unresolved incidents on the books. Each open ticket sits as an unmanaged liability.`,
        `Matukio ${count} bado wazi. Kila moja ni dhima.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 14,
      mitigationActions: [{ action: 'open_incident_resolution_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:incidents'], ruleId: 'operational.open_incidents',
    };
  },
};

const tenantDisputeEscalating: RiskRule = {
  id: 'counterparty.tenant_dispute_escalating', kind: 'counterparty', severity: 'medium', defaultTimeToImpactDays: 21,
  detect(s) { return s.disputeEscalatingCount > 0; },
  evaluate(s) {
    const count = s.disputeEscalatingCount;
    return {
      id: 'counterparty.tenant_dispute_escalating', kind: 'counterparty',
      severity: count >= 2 ? 'high' : 'medium',
      headline: bilingual(`${count} tenant dispute${count === 1 ? '' : 's'} escalating`,
        `Migogoro ya wapangaji ${count} inaongezeka`),
      narrative: bilingual(
        `${count} tenant dispute(s) are on an escalation trajectory. Resolve before tribunal stage.`,
        `Migogoro ${count} inaongezeka. Tatua kabla ya baraza.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 21,
      mitigationActions: [{ action: 'open_dispute_mediation', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:tenant-dispute'], ruleId: 'counterparty.tenant_dispute_escalating',
    };
  },
};

const contractorQualityRisk: RiskRule = {
  id: 'counterparty.contractor_quality_issues', kind: 'counterparty', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.contractorQualityIssues.length > 0; },
  evaluate(s) {
    const c = s.contractorQualityIssues[0]!;
    return {
      id: 'counterparty.contractor_quality_issues', kind: 'counterparty',
      severity: c.offSpecCount >= 3 ? 'high' : 'medium',
      headline: bilingual(`${c.contractorName} ${c.offSpecCount} off-spec submissions`,
        `${c.contractorName} amewasilisha kazi duni mara ${c.offSpecCount}`),
      narrative: bilingual(
        `${c.contractorName} delivered ${c.offSpecCount} off-spec items in the last window. Escalate or backfill.`,
        `${c.contractorName} amewasilisha ${c.offSpecCount} kazi duni. Panga utatuzi.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_contractor_quality_review', label: MIT_SCHEDULE_REVIEW }],
      relatedScopes: [], citations: ['bossnyumba:contractor-quality'], ruleId: 'counterparty.contractor_quality_issues',
    };
  },
};

const localRentDropRisk: RiskRule = {
  id: 'market.local_rent_drop', kind: 'market', severity: 'medium', defaultTimeToImpactDays: 90,
  detect(s) { return s.localMarketRentDropPct !== null && s.localMarketRentDropPct >= 5; },
  evaluate(s) {
    const pct = s.localMarketRentDropPct ?? 0;
    return {
      id: 'market.local_rent_drop', kind: 'market', severity: pct >= 10 ? 'high' : 'medium',
      headline: bilingual(`Local market rent dropped ${pct.toFixed(1)}%`,
        `Bei ya kodi ya eneo imeshuka asilimia ${pct.toFixed(1)}`),
      narrative: bilingual(
        `Sub-market average rent dropped ${pct.toFixed(1)}%. Defensive renewal terms keep occupancy from sliding.`,
        `Wastani wa kodi katika eneo umeshuka asilimia ${pct.toFixed(1)}.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 90,
      mitigationActions: [{ action: 'open_defensive_rent_strategy', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:market-rent'], ruleId: 'market.local_rent_drop',
    };
  },
};

const successionOverdueRisk: RiskRule = {
  id: 'estate.succession_review_overdue', kind: 'estate', severity: 'medium', defaultTimeToImpactDays: 60,
  detect(s) { return s.successionReviewOverdueDays !== null && s.successionReviewOverdueDays > 365; },
  evaluate(s) {
    const days = s.successionReviewOverdueDays ?? 365;
    return {
      id: 'estate.succession_review_overdue', kind: 'estate',
      severity: (s.principalOwnerAgeYears ?? 0) >= 65 ? 'high' : 'medium',
      headline: bilingual(`Succession review overdue ${days} day${days === 1 ? '' : 's'}`,
        `Ukaguzi wa urithi umechelewa siku ${days}`),
      narrative: bilingual(
        `Succession plan last reviewed ${days} days ago. Refresh before life events compress the timeline.`,
        `Mpango wa urithi haujakaguliwa kwa siku ${days}.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 60,
      mitigationActions: [{ action: 'open_succession_review_wizard', label: MIT_SCHEDULE_REVIEW }],
      relatedScopes: [], citations: ['bossnyumba:succession'], ruleId: 'estate.succession_review_overdue',
    };
  },
};

const titleDeedDriftRisk: RiskRule = {
  id: 'estate.title_deed_drift', kind: 'estate', severity: 'medium', defaultTimeToImpactDays: 45,
  detect(s) { return s.titleDeedRegistrationDriftDays !== null && s.titleDeedRegistrationDriftDays > 60; },
  evaluate(s) {
    const days = s.titleDeedRegistrationDriftDays ?? 60;
    return {
      id: 'estate.title_deed_drift', kind: 'estate', severity: days > 180 ? 'high' : 'medium',
      headline: bilingual(`Title-deed registration drift ${days} day${days === 1 ? '' : 's'}`,
        `Kuchelewa kusajili hati ya mali siku ${days}`),
      narrative: bilingual(
        `Title-deed registration is ${days} days behind on at least one property. Drift past 6 months tilts a sale dispute against you.`,
        `Usajili wa hati umechelewa siku ${days}.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 45,
      mitigationActions: [{ action: 'open_title_deed_remediation', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:title-deed'], ruleId: 'estate.title_deed_drift',
    };
  },
};

const uninsuredPropertyRisk: RiskRule = {
  id: 'estate.uninsured_property', kind: 'estate', severity: 'high', defaultTimeToImpactDays: 14,
  detect(s) { return s.propertiesWithoutInsuranceCount > 0; },
  evaluate(s) {
    const count = s.propertiesWithoutInsuranceCount;
    const avg = s.avgPropertyValuationForUninsured ?? 0;
    const exposure = avg * count;
    return {
      id: 'estate.uninsured_property', kind: 'estate', severity: count >= 2 ? 'critical' : 'high',
      headline: bilingual(`${count} property${count === 1 ? '' : 'ies'} are currently uninsured`,
        `Mali ${count} hazina bima`),
      narrative: bilingual(
        `${count} property(ies) are uninsured. Total replacement-cost exposure: ~${exposure.toLocaleString()}.`,
        `Mali ${count} hazina bima. Hatari ya jumla: ~${exposure.toLocaleString()}.`),
      exposureAmount: exposure > 0 ? exposure : null, currencyCode: currencyOf(s), timeToImpactDays: 14,
      mitigationActions: [{ action: 'open_emergency_insurance_quote', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:uninsured-property'], ruleId: 'estate.uninsured_property',
    };
  },
};

const tenantConcentrationRisk: RiskRule = {
  id: 'estate.tenant_concentration', kind: 'estate', severity: 'medium', defaultTimeToImpactDays: 60,
  detect(s) { return s.topTenantRevenuePct !== null && s.topTenantRevenuePct > 25; },
  evaluate(s) {
    const pct = s.topTenantRevenuePct ?? 0;
    return {
      id: 'estate.tenant_concentration', kind: 'estate', severity: pct > 50 ? 'high' : 'medium',
      headline: bilingual(`Top tenant carries ${pct.toFixed(1)}% of revenue`,
        `Mpangaji wa juu anachukua asilimia ${pct.toFixed(1)} ya mapato`),
      narrative: bilingual(
        `Single-tenant concentration at ${pct.toFixed(1)}%. A default would crater monthly cash by the same share.`,
        `Mpangaji mmoja anachukua asilimia ${pct.toFixed(1)}.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 60,
      mitigationActions: [{ action: 'open_diversification_plan', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:tenant-concentration'], ruleId: 'estate.tenant_concentration',
    };
  },
};

const securityAccessAnomalyRisk: RiskRule = {
  id: 'security.access_anomaly', kind: 'security', severity: 'high', defaultTimeToImpactDays: 1,
  detect(s) { return s.accessAnomaliesLastHour >= 3 || s.failedAuthSpike >= 10 || s.suspiciousActionCount >= 3; },
  evaluate(s) {
    return {
      id: 'security.access_anomaly', kind: 'security', severity: 'high',
      headline: bilingual(`Security anomaly spike detected`, `Mabadiliko ya usalama yamegunduliwa`),
      narrative: bilingual(
        `Anomalous access pattern: ${s.accessAnomaliesLastHour} anomalies, ${s.failedAuthSpike} failed auth attempts, ${s.suspiciousActionCount} suspicious actions. Lock the suspect account.`,
        `Tabia ya kushuku: ${s.accessAnomaliesLastHour} matukio, ${s.failedAuthSpike} majaribio, ${s.suspiciousActionCount} vitendo. Funga akaunti.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 1,
      mitigationActions: [{ action: 'open_security_lockdown_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:security-anomaly'], ruleId: 'security.access_anomaly',
    };
  },
};

const reputationalCommunityComplaints: RiskRule = {
  id: 'reputational.community_complaints', kind: 'reputational', severity: 'medium', defaultTimeToImpactDays: 30,
  detect(s) { return s.tenantGrievances60d >= 3 || s.communityComplaintsOverdue > 0; },
  evaluate(s) {
    const g = s.tenantGrievances60d;
    const c = s.communityComplaintsOverdue;
    return {
      id: 'reputational.community_complaints', kind: 'reputational',
      severity: g >= 5 || c >= 3 ? 'high' : 'medium',
      headline: bilingual(`${g} grievance${g === 1 ? '' : 's'} + ${c} community complaint${c === 1 ? '' : 's'} accumulating`,
        `Malalamiko ${g} ya wapangaji + ${c} ya jumuiya yameongezeka`),
      narrative: bilingual(
        `Tenant grievances (${g}) and community complaints (${c}) are accumulating. Each overflows to social channels if unanswered.`,
        `Malalamiko (${g}) na (${c}) yanaongezeka.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_grievance_triage', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:grievances'], ruleId: 'reputational.community_complaints',
    };
  },
};

const withholdingUnderprovision: RiskRule = {
  id: 'tax.withholding_underprovision', kind: 'tax', severity: 'medium', defaultTimeToImpactDays: 60,
  detect(s) {
    if (s.withholdingTaxPayable === null || s.withholdingProvision === null) return false;
    return s.withholdingTaxPayable > s.withholdingProvision * 1.2;
  },
  evaluate(s) {
    const gap = (s.withholdingTaxPayable ?? 0) - (s.withholdingProvision ?? 0);
    return {
      id: 'tax.withholding_underprovision', kind: 'tax', severity: 'medium',
      headline: bilingual(`Withholding-tax payable exceeds provision`, `Kodi ya withholding inazidi akiba`),
      narrative: bilingual(
        `Withholding-tax payable exceeds the provision by ~${gap.toLocaleString()}. Top up.`,
        `Kodi inazidi akiba kwa takriban ${gap.toLocaleString()}.`),
      exposureAmount: gap, currencyCode: currencyOf(s), timeToImpactDays: 60,
      mitigationActions: [{ action: 'open_tax_provision_wizard', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:withholding-tax'], ruleId: 'tax.withholding_underprovision',
    };
  },
};

const taxInquiryOpen: RiskRule = {
  id: 'tax.inquiry_open', kind: 'tax', severity: 'high', defaultTimeToImpactDays: 30,
  detect(s) { return s.taxInquiryOpen; },
  evaluate(s) {
    return {
      id: 'tax.inquiry_open', kind: 'tax', severity: 'high',
      headline: bilingual(`Tax authority inquiry open`, `Uchunguzi wa mamlaka ya kodi upo wazi`),
      narrative: bilingual(
        `An active tax-authority inquiry is open. Respond on time through counsel.`,
        `Uchunguzi wa kodi upo wazi. Jibu kwa wakati.`),
      exposureAmount: null, currencyCode: currencyOf(s), timeToImpactDays: 30,
      mitigationActions: [{ action: 'open_tax_response_workspace', label: MIT_OPEN_WIZARD }],
      relatedScopes: [], citations: ['bossnyumba:tax-inquiry'], ruleId: 'tax.inquiry_open',
    };
  },
};

const topContractExpiringRisk: RiskRule = {
  id: 'legal.top_contract_expiring', kind: 'legal', severity: 'medium', defaultTimeToImpactDays: 45,
  detect(s) { return s.top3ContractsExpiring60d.some((c) => !c.hasRenewalInFlight && c.daysToExpiry <= 45); },
  evaluate(s) {
    const c = s.top3ContractsExpiring60d.find((x) => !x.hasRenewalInFlight)!;
    return {
      id: 'legal.top_contract_expiring', kind: 'legal', severity: c.daysToExpiry <= 14 ? 'high' : 'medium',
      headline: bilingual(`${c.counterpartyName} contract expires in ${c.daysToExpiry}d — no renewal in flight`,
        `Mkataba wa ${c.counterpartyName} unaisha siku ${c.daysToExpiry}`),
      narrative: bilingual(
        `Top contract with ${c.counterpartyName} expires in ${c.daysToExpiry} days without active renewal. Annualised value: ~${(c.annualValue ?? 0).toLocaleString()}.`,
        `Mkataba mkuu wa ${c.counterpartyName} unaisha siku ${c.daysToExpiry}.`),
      exposureAmount: c.annualValue ?? null, currencyCode: currencyOf(s),
      timeToImpactDays: c.daysToExpiry,
      mitigationActions: [{ action: 'draft_contract_renewal', label: MIT_DRAFT_RENEWAL }],
      relatedScopes: [c.contractId], citations: ['bossnyumba:top-contract'], ruleId: 'legal.top_contract_expiring',
    };
  },
};

export const RISK_RULES: ReadonlyArray<RiskRule> = Object.freeze([
  cashRunwayBelow90d,
  cashArAgingCritical,
  cashPayrollAtRisk,
  mortgagePaymentRisk,
  tenantsArrears30dPlus,
  insuranceCertExpiring,
  fireSafetyCertExpiring,
  gasSafetyCertExpiring,
  housingFilingOverdue,
  regulatorInspectionDue,
  propertyTaxOverdue,
  hoaDuesOverdue,
  maintenanceOverSla,
  contractorRepeatNonPerformance,
  leaseExpiryWithoutRenewal,
  evictionDeadlineRisk,
  staffAttritionSpike,
  staffCertsExpired,
  housingComplianceAmber,
  safetyComplianceAmber,
  openIncidentsRisk,
  tenantDisputeEscalating,
  contractorQualityRisk,
  localRentDropRisk,
  successionOverdueRisk,
  titleDeedDriftRisk,
  uninsuredPropertyRisk,
  tenantConcentrationRisk,
  securityAccessAnomalyRisk,
  reputationalCommunityComplaints,
  withholdingUnderprovision,
  taxInquiryOpen,
  topContractExpiringRisk,
]);
