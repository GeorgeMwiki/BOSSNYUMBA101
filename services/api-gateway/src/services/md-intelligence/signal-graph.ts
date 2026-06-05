/**
 * Domain signal graph — typed, frozen, statically declared
 * (real-estate edition).
 *
 * Ported from Borjie's mining signal graph and re-authored for
 * BossNyumba's real-estate operating model. Each edge encodes a known
 * causal or correlational link between two sub-areas across (or within)
 * the 14 real-estate-OS domains. The graph is consumed by:
 *
 *   - correlation-engine.ts (which OTHER domains the asked-about state
 *     touches RIGHT NOW)
 *   - causation-tracer.ts (walk UPSTREAM from a symptom to surface root
 *     causes)
 *   - comparison-framework.ts (which baselines apply per metric)
 *   - insight-emitter.ts (compose non-obvious opportunities, risks,
 *     anomalies, trends)
 *
 * Domain adaptation (mining → real estate):
 *   - geology  → maintenance   - licences → leasing
 *   - production / tonnage → occupancy / collections (modelled as
 *     sub-areas inside operations / finance / leasing)
 *   - royalty  → rent          - buyer    → tenant
 * The central real-estate web is:
 *   arrears ↔ rent ↔ leasing ↔ maintenance ↔ compliance ↔ treasury ↔
 *   occupancy ↔ marketplace ↔ holdings ↔ succession ↔ asset-register.
 *
 * The graph is frozen at module load. Mutating it at runtime is a hard
 * failure. To grow the graph: add the edge here. Edges are dotted ids
 * `<domain>.<sub_area>`; both ends MUST resolve to a known domain via
 * `domainOf`.
 */

import type { DomainId } from './types.js';

export type SignalEdgeKind = 'causal' | 'correlational' | 'composite';
export type SignalEdgeDirection = 'forward' | 'bidirectional';

/**
 * A single graph edge.
 *
 *   - `from` / `to` are dotted ids: `<domain>.<sub_area>`. Both ends MUST
 *     resolve to a known domain.
 *   - `strength` is 0..1 — calibrated against telemetry or industry
 *     baseline.
 *   - `lagDays` is the typical observed lag from `from` move to `to`
 *     move. Same-day = 0.
 */
export interface SignalEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: SignalEdgeKind;
  readonly direction: SignalEdgeDirection;
  readonly strength: number;
  readonly lagDays: number;
  readonly rationale: string;
}

/** Reverse-engineer a domain id from a dotted sub-area id. */
export function domainOf(subAreaId: string): DomainId | undefined {
  const dot = subAreaId.indexOf('.');
  if (dot < 0) return undefined;
  const head = subAreaId.slice(0, dot);
  return DOMAINS.has(head as DomainId) ? (head as DomainId) : undefined;
}

const DOMAINS: ReadonlySet<DomainId> = new Set<DomainId>([
  'compliance',
  'finance',
  'operations',
  'hr',
  'marketing',
  'risk',
  'treasury',
  'maintenance',
  'marketplace',
  'leasing',
  'holdings',
  'subsidiaries',
  'succession',
  'asset-register',
]);

// ─────────────────────────────────────────────────────────────────────
// Edge list (90 edges; target ≥ 60 per spec).
// ─────────────────────────────────────────────────────────────────────

export const SIGNAL_EDGES: ReadonlyArray<SignalEdge> = Object.freeze([
  // Compliance internal cascades
  edge('compliance.fire_safety', 'compliance.occupancy_permit', 'causal', 'forward', 0.9, 0,
    'A lapsed fire-safety certificate blocks renewal of the building occupancy permit.'),
  edge('compliance.tax', 'compliance.banking', 'causal', 'forward', 0.85, 7,
    'Late landlord rental-income tax freezes the rent-collection settlement account until the receipt is presented.'),
  edge('compliance.tax', 'compliance.business_registration', 'causal', 'forward', 0.6, 30,
    'A tax-defaulters listing flows to the registry annual-return review and can trigger a director query.'),
  edge('compliance.health_safety', 'compliance.staff_certifications', 'causal', 'forward', 0.7, 14,
    'A workplace safety incident reopens facilities-staff competency certification checks.'),
  edge('compliance.aml_kyc', 'compliance.banking', 'causal', 'forward', 0.8, 0,
    'An AML red flag on a tenant or vendor suspends the rent-settlement account instantly.'),
  edge('compliance.data_protection', 'compliance.tenant_consents', 'composite', 'forward', 0.75, 1,
    'Missing data-processing consent blocks lawful tenant screening on the same application.'),
  edge('compliance.labour', 'compliance.health_safety', 'correlational', 'forward', 0.55, 30,
    'Unresolved labour grievances among site staff correlate with rising near-miss incidents.'),
  edge('compliance.local_authority', 'compliance.occupancy_permit', 'causal', 'forward', 0.7, 90,
    'Failing a local-authority by-law inspection triggers a notice that can escalate to an occupancy suspension.'),

  // Compliance → Finance / Treasury / Risk
  edge('compliance.tax', 'finance.tax_provisioning', 'causal', 'forward', 0.95, 0,
    'The rental-income tax draft IS the provisioning line; missing the draft = wrong P&L.'),
  edge('compliance.tax', 'treasury.cash_position', 'causal', 'forward', 0.6, 15,
    'A penalty (interest + surcharge) on late rental-income tax drains cash by cut-off + 15d.'),
  edge('compliance.banking', 'treasury.fx_hedging', 'causal', 'forward', 0.85, 0,
    'Loss of settlement-account access forces an unhedged cross-border rent position.'),
  edge('compliance.banking', 'finance.fx_exposure', 'causal', 'forward', 0.9, 0,
    'Same incident on the finance ledger view.'),
  edge('compliance.fire_safety', 'risk.safety_risk', 'causal', 'forward', 0.9, 0,
    'An amber fire-safety certificate pushes the building safety-risk register off green.'),
  edge('compliance.occupancy_permit', 'risk.regulatory_risk', 'causal', 'forward', 0.85, 0,
    'An imminent occupancy-permit expiry raises the regulator-risk score.'),
  edge('compliance.aml_kyc', 'risk.cyber_risk', 'correlational', 'forward', 0.4, 30,
    'AML failures correlate with KYC document leaks (cyber exposure).'),
  edge('compliance.insurance', 'risk.insurance_gap', 'causal', 'bidirectional', 0.95, 0,
    'Same data point on two views; bidirectional because the gap is read both ways.'),

  // Operations → Finance / Compliance / Risk (occupancy = the production analogue)
  edge('operations.occupancy', 'finance.profit_loss', 'causal', 'forward', 0.95, 30,
    'Occupancy rate feeds the rent-revenue line on the next monthly close.'),
  edge('operations.occupancy', 'compliance.tax', 'causal', 'forward', 0.9, 15,
    'Collected rent drives the rental-income tax draft per the monthly filing cadence.'),
  edge('operations.utilities', 'operations.occupancy', 'causal', 'forward', 0.85, 5,
    'A utilities outage (water / power) at a building triggers tenant move-outs within a week.'),
  edge('operations.utilities', 'finance.opex', 'causal', 'forward', 0.95, 30,
    'Recoverable utilities are a large opex line; tariff moves hit P&L next close.'),
  edge('operations.amenity_availability', 'operations.occupancy', 'causal', 'forward', 0.85, 1,
    'A lift / generator / borehole breakdown trims lettable desirability immediately.'),
  edge('operations.staffing_roster', 'operations.occupancy', 'causal', 'forward', 0.85, 1,
    'Understaffed caretaker / security shifts degrade the tenant experience same-day.'),
  edge('operations.incident_log', 'compliance.health_safety', 'causal', 'forward', 0.95, 0,
    'Every recorded site incident lands on the health-and-safety register automatically.'),
  edge('operations.incident_log', 'risk.operational_risk', 'causal', 'forward', 0.9, 7,
    'Repeat incidents at a property raise the operational-risk score within a week.'),
  edge('operations.waste_water', 'compliance.local_authority', 'causal', 'forward', 0.95, 0,
    'A failing sewerage / waste-water system triggers the local-authority quarterly filing line.'),
  edge('operations.waste_water', 'risk.safety_risk', 'causal', 'forward', 0.95, 0,
    'Same incident on the risk register view.'),
  edge('maintenance.planned_maintenance', 'operations.amenity_availability', 'causal', 'forward', 0.8, 14,
    'Skipped planned maintenance correlates with amenity breakdowns two weeks later.'),
  edge('operations.turnover_make_ready', 'operations.occupancy', 'causal', 'forward', 0.7, 0,
    'A make-ready backlog caps how fast vacant units re-let same-cycle.'),

  // HR → Operations / Compliance / Finance / Risk
  edge('hr.shifts_attendance', 'operations.staffing_roster', 'causal', 'bidirectional', 0.9, 0,
    'Same headcount; attendance data flows both ways.'),
  edge('hr.shifts_attendance', 'operations.occupancy', 'causal', 'forward', 0.8, 1,
    'Caretaker / security absenteeism degrades the tenant experience the next day.'),
  edge('hr.certifications_expiring', 'compliance.staff_certifications', 'causal', 'bidirectional', 0.95, 0,
    'Mirror sub-area on two domain panels.'),
  edge('hr.statutory_contributions', 'compliance.labour', 'causal', 'forward', 0.95, 0,
    'A pension / social-security default IS a labour breach.'),
  edge('hr.statutory_contributions', 'finance.opex', 'causal', 'forward', 0.95, 30,
    'Statutory contributions hit payroll opex next close.'),
  edge('hr.payroll_readiness', 'treasury.cash_position', 'causal', 'forward', 0.85, 1,
    'Payroll day is the largest single staffing-side cash outflow.'),
  edge('hr.safety_incidents', 'operations.incident_log', 'causal', 'bidirectional', 0.9, 0,
    'Mirror sub-area, different domain panel.'),
  edge('hr.open_grievances', 'risk.human_capital_risk', 'causal', 'forward', 0.7, 14,
    'Unresolved staff grievances raise the industrial-action probability.'),
  edge('hr.leavers_exit', 'operations.occupancy', 'causal', 'forward', 0.5, 30,
    'Voluntary attrition (esp. property managers) trims the tenant experience over a month.'),
  edge('hr.leavers_exit', 'operations.staffing_roster', 'causal', 'forward', 0.7, 14,
    'Same lever, faster signal on the roster panel.'),

  // Maintenance → Operations / Finance / Risk / Asset-register
  edge('maintenance.work_order_backlog', 'operations.occupancy', 'causal', 'forward', 0.7, 30,
    'A growing work-order backlog erodes tenant satisfaction and lifts churn.'),
  edge('maintenance.inspection_findings', 'compliance.fire_safety', 'causal', 'forward', 0.8, 14,
    'Open inspection findings flow into the fire-safety renewal evidence pack.'),
  edge('maintenance.condition_grade', 'finance.profit_loss', 'causal', 'forward', 0.6, 90,
    'A declining building condition grade depresses achievable rent on renewal.'),
  edge('maintenance.condition_grade', 'asset-register.fixed_assets', 'causal', 'forward', 0.7, 90,
    'Condition deterioration accelerates the carrying-value impairment on the asset register.'),
  edge('maintenance.preventive_coverage', 'risk.operational_risk', 'causal', 'forward', 0.75, 30,
    'Thin preventive-maintenance coverage raises the operational-risk score.'),
  edge('maintenance.contractor_sla', 'maintenance.work_order_backlog', 'causal', 'forward', 0.8, 7,
    'Contractor SLA breaches feed straight into the work-order backlog within a week.'),
  edge('maintenance.capex_pipeline', 'finance.capex', 'causal', 'bidirectional', 0.9, 0,
    'The major-works capex pipeline IS the capex line.'),
  edge('maintenance.condition_grade', 'marketplace.price_benchmarks', 'correlational', 'forward', 0.5, 7,
    'Higher-condition-grade units list at an above-market asking-rent premium.'),

  // Treasury → Finance / Compliance / Marketplace / Risk
  edge('treasury.cash_position', 'finance.cash_flow', 'causal', 'bidirectional', 0.95, 0,
    'Same number on two views.'),
  edge('treasury.fx_hedging', 'finance.fx_exposure', 'causal', 'bidirectional', 0.95, 0,
    'Mirror.'),
  edge('treasury.rent_settlement', 'marketplace.payout_documentation', 'causal', 'forward', 0.85, 0,
    'No settlement-account approval = no owner payout disbursement.'),
  edge('treasury.rent_settlement', 'compliance.banking', 'causal', 'bidirectional', 0.9, 0,
    'Mutual entanglement of settlement state and banking compliance.'),
  edge('treasury.debt_service', 'risk.financial_risk', 'causal', 'forward', 0.85, 30,
    'A missed mortgage / facility coupon raises counterparty credit risk.'),
  edge('treasury.working_capital_lines', 'finance.working_capital', 'causal', 'bidirectional', 0.9, 0,
    'Mirror.'),

  // Marketplace → Compliance / Finance / Treasury / Risk
  edge('marketplace.active_listings', 'finance.profit_loss', 'causal', 'forward', 0.7, 14,
    'List-to-lease 14d → rent revenue lands on next close.'),
  edge('marketplace.applications_received', 'marketplace.lease_velocity', 'correlational', 'forward', 0.6, 7,
    'A strong application stack shortens list-to-lease.'),
  edge('marketplace.tenant_vetting', 'compliance.aml_kyc', 'causal', 'bidirectional', 0.95, 0,
    'Mirror sub-area.'),
  edge('marketplace.viewing_chain', 'compliance.data_protection', 'causal', 'forward', 0.95, 0,
    'The lawful-basis filing requires the viewing-consent chain.'),
  edge('marketplace.payout_documentation', 'compliance.banking', 'causal', 'bidirectional', 0.95, 0,
    'Same data on two views.'),
  edge('marketplace.price_benchmarks', 'finance.profit_loss', 'causal', 'forward', 0.85, 1,
    'A market-rent index move shifts the rent-revenue figure on the next lease.'),
  edge('marketplace.price_benchmarks', 'leasing.renewal_pipeline', 'causal', 'forward', 0.85, 1,
    'The market-rent index drives the renewal-uplift offer.'),
  edge('marketplace.dispute_refund_log', 'risk.counterparty_risk', 'causal', 'forward', 0.7, 30,
    'A rising deposit-dispute rate = counterparty credit risk up.'),

  // Risk → enterprise feedback loops
  edge('risk.market_rent', 'finance.profit_loss', 'causal', 'forward', 0.95, 30,
    'A market-rent swing hits the revenue line.'),
  edge('risk.currency_risk', 'treasury.fx_hedging', 'causal', 'bidirectional', 0.9, 0,
    'The hedge IS the response to currency risk.'),
  edge('risk.counterparty_risk', 'marketplace.tenant_vetting', 'causal', 'forward', 0.7, 30,
    'A tenant-cohort downgrade triggers a vetting reopen.'),
  edge('risk.cyber_risk', 'compliance.data_protection', 'causal', 'forward', 0.8, 0,
    'A breach kicks the statutory data-protection notification clock.'),
  edge('risk.geopolitical', 'compliance.aml_kyc', 'correlational', 'forward', 0.6, 14,
    'A regional sanctions surge raises KYC flags on cross-border tenants and investors.'),

  // Marketing → Reputation / Risk / Marketplace
  edge('marketing.tenant_sentiment', 'risk.reputational_risk', 'causal', 'forward', 0.8, 7,
    'Tenant grievance volume up = reputational risk up.'),
  edge('marketing.tenant_sentiment', 'operations.occupancy', 'correlational', 'forward', 0.6, 30,
    'Tenant-satisfaction scores correlate with retention and therefore occupancy.'),
  edge('marketing.counterparty_perception', 'marketplace.applications_received', 'correlational', 'forward', 0.5, 30,
    'Prospect / agent NPS correlates with application intensity.'),
  edge('marketing.pr_crisis_log', 'risk.reputational_risk', 'causal', 'forward', 0.9, 0,
    'Mirror with intensity.'),
  edge('marketing.investor_communications', 'treasury.bank_relationships', 'correlational', 'forward', 0.5, 30,
    'A strong investor / board pack correlates with covenant headroom.'),

  // Leasing — the lease-lifecycle domain (royalty/licence analogue)
  edge('leasing.arrears', 'finance.profit_loss', 'causal', 'forward', 0.9, 15,
    'Rent arrears are the single largest drag on net rental income at close.'),
  edge('leasing.arrears', 'treasury.cash_position', 'causal', 'forward', 0.85, 7,
    'Arrears directly deplete the available cash position within the collection window.'),
  edge('leasing.arrears', 'risk.financial_risk', 'causal', 'forward', 0.8, 30,
    'A rising arrears ratio raises the portfolio financial-risk score.'),
  edge('leasing.lease_expiries', 'operations.occupancy', 'causal', 'forward', 0.85, 30,
    'A cluster of lease expiries without renewals trims occupancy next month.'),
  edge('leasing.lease_expiries', 'leasing.renewal_pipeline', 'causal', 'forward', 0.9, 0,
    'Every expiry IS a renewal-pipeline item.'),
  edge('leasing.renewal_pipeline', 'operations.occupancy', 'causal', 'forward', 0.8, 30,
    'Renewal-pipeline conversion is the dominant lever on forward occupancy.'),
  edge('leasing.renewal_pipeline', 'finance.profit_loss', 'causal', 'forward', 0.85, 30,
    'Renewal uplifts feed the rent-revenue line on the next close.'),
  edge('leasing.deposit_register', 'compliance.tenant_deposits', 'causal', 'bidirectional', 0.95, 0,
    'The held-deposit register IS the deposit-protection compliance view.'),

  // Holdings / Subsidiaries / Succession — corporate edges
  edge('holdings.beneficial_ownership', 'compliance.business_registration', 'causal', 'forward', 0.9, 0,
    'The registry wants UBO filings current for every property-holding entity.'),
  edge('holdings.inter_company_loans', 'compliance.tax', 'causal', 'forward', 0.7, 30,
    'Transfer-pricing documentation between holdco / SPV / REIT flows into the tax filing.'),
  edge('subsidiaries.statutory_filings', 'compliance.business_registration', 'causal', 'forward', 0.9, 0,
    'Mirror per entity.'),
  edge('subsidiaries.tax_filings', 'compliance.tax', 'causal', 'forward', 0.95, 0,
    'Mirror per entity at group view.'),
  edge('subsidiaries.active_disputes', 'risk.regulatory_risk', 'causal', 'forward', 0.7, 30,
    'Open litigation against a property SPV raises the regulator score.'),
  edge('succession.key_role_coverage', 'risk.human_capital_risk', 'causal', 'forward', 0.85, 90,
    'An empty bench on key estate roles = key-person risk amber.'),
  edge('succession.ownership_transition', 'holdings.beneficial_ownership', 'causal', 'forward', 0.9, 0,
    'A share / title transfer requires a UBO filing.'),
  edge('succession.estate_planning', 'holdings.group_structure', 'causal', 'forward', 0.6, 180,
    'An estate event triggers a group restructure on the 6-month horizon.'),

  // Asset register — fixed asset edges
  edge('asset-register.fixed_assets', 'finance.capex', 'causal', 'bidirectional', 0.95, 0,
    'Same number on two views.'),
  edge('asset-register.building_systems', 'operations.amenity_availability', 'causal', 'bidirectional', 0.85, 0,
    'Same plant (lifts / HVAC / generators) on two views.'),
  edge('asset-register.land_bank', 'finance.working_capital', 'causal', 'forward', 0.9, 0,
    'Undeveloped land-bank valuation IS a working-capital line.'),
  edge('asset-register.consumables_stock', 'operations.utilities', 'causal', 'forward', 0.9, 7,
    'Consumables inventory on the asset side; utilities opex on the ops side.'),
  edge('asset-register.insured_asset_reconciliation', 'compliance.insurance', 'causal', 'forward', 0.95, 0,
    'A reconciliation gap = a policy gap.'),
  edge('asset-register.fixtures_fittings', 'leasing.deposit_register', 'causal', 'forward', 0.6, 0,
    'Fixtures-and-fittings schedules anchor end-of-tenancy deposit deductions.'),

  // Long-lag environmental + climate edges
  edge('risk.climate_risk', 'operations.occupancy', 'causal', 'forward', 0.6, 90,
    'A flood / drought event trims a quarter of occupancy at exposed properties.'),
  edge('maintenance.flood_drainage', 'risk.climate_risk', 'causal', 'forward', 0.85, 30,
    'A drainage surprise raises the climate-risk score within a month.'),
  edge('compliance.fire_safety', 'marketing.tenant_sentiment', 'correlational', 'forward', 0.5, 60,
    'A clean fire-safety refresh lifts tenant sentiment.'),

  // Composite chains
  edge('hr.leavers_exit', 'operations.occupancy', 'composite', 'forward', 0.6, 30,
    'Composite chain: leavers → roster → tenant experience → occupancy. Effective strength 0.7*0.85.'),
  edge('compliance.tax', 'marketplace.payout_documentation', 'composite', 'forward', 0.72, 7,
    'Composite chain: late rental-income tax → banking freeze → owner payout blocked.'),
  edge('risk.market_rent', 'finance.profit_loss', 'composite', 'forward', 0.81, 30,
    'Composite chain: market-rent move → index-linked rent revenue → next close.'),
]);

// ─────────────────────────────────────────────────────────────────────
// Helpers (small, pure)
// ─────────────────────────────────────────────────────────────────────

function edge(
  from: string,
  to: string,
  kind: SignalEdgeKind,
  direction: SignalEdgeDirection,
  strength: number,
  lagDays: number,
  rationale: string,
): SignalEdge {
  return Object.freeze({ from, to, kind, direction, strength, lagDays, rationale });
}

/** Return all edges where `nodeId` is the `from` side (outbound). */
export function outboundEdges(nodeId: string): ReadonlyArray<SignalEdge> {
  return SIGNAL_EDGES.filter(
    (e) => e.from === nodeId || (e.direction === 'bidirectional' && e.to === nodeId),
  );
}

/** Return all edges where `nodeId` is the `to` side (inbound — upstream). */
export function inboundEdges(nodeId: string): ReadonlyArray<SignalEdge> {
  return SIGNAL_EDGES.filter(
    (e) => e.to === nodeId || (e.direction === 'bidirectional' && e.from === nodeId),
  );
}

/** Return outbound edges grouped by the target's domain (best per domain). */
export function topTouchesForNode(
  nodeId: string,
  limit = 3,
): ReadonlyArray<SignalEdge> {
  const candidates = outboundEdges(nodeId);
  const bestPerDomain = new Map<DomainId, SignalEdge>();
  for (const e of candidates) {
    const targetNode = e.from === nodeId ? e.to : e.from;
    const domain = domainOf(targetNode);
    if (!domain) continue;
    const existing = bestPerDomain.get(domain);
    if (!existing || existing.strength < e.strength) {
      bestPerDomain.set(domain, e);
    }
  }
  return Object.freeze(
    Array.from(bestPerDomain.values())
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit),
  );
}

/** Set of every node referenced by any edge. */
export function referencedNodes(): ReadonlySet<string> {
  const set = new Set<string>();
  for (const e of SIGNAL_EDGES) {
    set.add(e.from);
    set.add(e.to);
  }
  return set;
}
