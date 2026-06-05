/**
 * Brain-tools barrel — assembles the persona-aware tool catalog
 * (real-estate edition).
 *
 * `buildPersonaToolHandlers(gate)` is the single entry point called from
 * the api-gateway composition root. It:
 *
 *   1. Concatenates the persona-scoped catalogs (owner / manager /
 *      worker / customer / admin) with the shared catalog.
 *   2. Deduplicates by tool id (defensive — if two source lists
 *      register the same id, the first occurrence wins and a warning
 *      surfaces via the optional `onDuplicate` callback).
 *   3. Wraps each descriptor with `toBrainToolHandler` so the
 *      orchestrator's `ToolDispatcher` can register it.
 *
 * Tenant isolation: each handler resolves `tenantId` from the
 * tool-execution context per call. No descriptor closes over a tenant
 * identifier.
 *
 * Ported from Borjie — only the GENERIC categories (capability,
 * jurisdiction, jurisdiction-discovery, reason-strategize) land in
 * the first wave. Real-estate-specific tool categories (lease,
 * rent-collection, work-order, viewings, KYC) will land in follow-up
 * commits, each retailored from the corresponding Borjie mining
 * domain (RFB → application, opportunity-scanner → rent-uplift, etc.).
 */

import type { ToolHandler } from '@bossnyumba/ai-copilot';
import { z } from 'zod';
import {
  toBrainToolHandler,
  type PersonaToolDescriptor,
  type PersonaToolGate,
} from './types.js';
// Capability disclosure CSA-3 + CSA-4 — two LOW-stakes read-only tools
// (`bossnyumba.capabilities.what_can_you_do`, `bossnyumba.about`) that
// surface the canonical capability registry from @bossnyumba/persona-
// runtime as USER-OUTCOME narrative answers.
import { CAPABILITY_TOOLS } from './capability-tools.js';
// Jurisdiction-discovery JC-1 + JC-6 — Mr. Mwikila NEVER says
// "I don't know" about a country. `bossnyumba.jurisdiction.discover`
// runs the on-demand pipeline and `bossnyumba.jurisdiction.switch`
// applies a per-turn or per-session override — but NEVER permanent
// (tenant.jurisdiction is LOCKED at signup; only BOSSNYUMBA internal
// admin can change it via the JC-7 four-eye route).
import { JURISDICTION_DISCOVERY_TOOLS } from './jurisdiction-discovery-tools.js';
// Jurisdiction JA-4 — `bossnyumba.jurisdiction.show_current` returns
// the tenant's current jurisdiction snapshot + bilingual offer to
// switch context.
import { JURISDICTION_TOOLS } from './jurisdiction-tools.js';
// Real-time reasoning RT-7 — `bossnyumba.reason.strategize` returns
// a structured StrategyTrace (current state prompt, constraints,
// 2-4 strategies with pros/cons/confidence, recommended_index, why,
// downsides, retrospective grade plan).
import { REASON_STRATEGIZE_TOOLS } from './reason-strategize-tool.js';
// Entity legibility (Wave ENTITY-LEGIBILITY) — 6 read-only tools
// (resolve / full_picture / recent / search / trace / deduplicate) that
// ground every chat reference to a concrete entity by id. Backed by the
// entity-index service (mig 0288). Persona: T1 owner + T2 admin only.
import { ENTITY_LEGIBILITY_TOOLS } from './entity-legibility-tools.js';
// Decision Journal (Wave DECISION-JOURNAL) — 6 read-only tools
// (recent / explain / search / replay / what_did_i_decide / success_rate)
// over the hash-chained `decisions` + `decision_outcomes` + `decision_links`
// tables (mig 0289). Multi-currency outcome shape (observedValue +
// observedCurrency). Persona: T1 owner + T2 admin only.
import { DECISION_JOURNAL_TOOLS } from './decision-journal-tools.js';
// PT-LH — Lease history chain-of-custody tools (append_step +
// show_trace). Visible to owner / manager / tenant personas; backed
// by services/api-gateway/src/services/lease-history/.
import { LEASE_HISTORY_TOOLS } from './lease-history-tools.js';
// PT-RP — Owner rent-payout settlement listing. Backed by the L8
// SettlementOrchestrator (services/api-gateway/src/services/settlement).
import { RENT_PAYOUT_TOOLS } from './rent-payout-tools.js';
// PT-A — Owner persona property tools (42 tools covering cockpit reads
// + lease lifecycle + delinquency + payroll + delegation + regulator
// disclosure + signed condition reports). Real-estate retailoring of
// Borjie's owner-tools.ts + owner-estate-tools.ts + companion catalogs.
import { OWNER_PROPERTY_TOOLS } from './owner-property-tools.js';
// Family-office / holdings tools (mandate-explicit per CLAUDE.md:
// "family office, succession, the full asset register, subsidiaries,
// holdings"). 5 LOW-stakes read-only OWNER (T1) tools
// (estate.net_worth_summary / lookup_entity / intercompany_flow_query /
// succession_review_needed / asset_register_browse). Ported from
// Borjie and retargeted mining holdco/SPV → property holdco/SPV/REIT.
// Honest-degraded: defers to /api/v1/estate/* which is not yet wired in
// BN, so handlers return empty "not yet wired" shapes (never fabricated)
// until those routes land.
import { OWNER_ESTATE_TOOLS } from './owner-estate-tools.js';
// PT-B — Manager persona tools (25 tools covering assign / dispatch /
// contractor engagement / move-in/out / security-deposit assessment /
// daily report / handoff notes). Real-estate retailoring of Borjie's
// manager-tools.ts.
import { MANAGER_TOOLS } from './manager-tools.js';
// PT-C — Maintenance staff persona tools (30 tools covering clock-in/out,
// task lifecycle, toolbox-talks, incidents, photos, work-orders,
// timesheets, leave, training, inspections). Real-estate retailoring
// of Borjie's worker-tools.ts.
import { STAFF_TOOLS } from './staff-tools.js';
// PT-D — Tenant persona tools (30 tools covering listing browse, lease
// lifecycle, rent payment via LedgerService, maintenance requests,
// complaints, KYC, move-in / move-out signing, market intel). Real-
// estate retailoring of Borjie's buyer-tools.ts.
import { TENANT_TOOLS } from './tenant-tools.js';
// Wave UNWIRED-LOGIC-SWEEP — Opportunity-scanner brain tools. Two
// LOW-stakes read-only tools (`property.opportunities.scan` +
// `property.opportunities.list_rules`) that surface the 33-rule
// opportunity engine the brain previously had no way to invoke.
import { OPPORTUNITY_SCANNER_TOOLS } from './opportunity-scanner-tools.js';
// Wave UNWIRED-LOGIC-SWEEP — Risk-scanner brain tools. MEDIUM-stakes
// read-only tools (`property.risks.scan` + `property.risks.list_rules`)
// that surface the 33-rule risk engine the brain previously had no way
// to invoke. Cockpit `risk.changed` SSE event fires alongside the scan.
import { RISK_SCANNER_TOOLS } from './risk-scanner-tools.js';
// Wave SUPERPOWERS — chat-as-OS write tools (share_view / bulk_action /
// undo_last_action / prefill_form). Backs the cross-cutting routes
// /owner/share-links, /owner/superpowers/{bulk-action,prefill},
// /owner/undo-journal. Owner + admin personas only (T1 + T2).
// bulk_action carries requiresPolicyRuleLiteral=true (CLAUDE.md hard
// rule: HIGH-risk prefixes must hit literal policy rules, no reason-
// resolver generalisation).
import { SUPERPOWERS_TOOLS } from './superpowers-tools.js';
// Chat-King wave — close BN owner-portal chat-reachability gaps.
// 5 HIGH-stakes WRITE tools wrap real existing gateway routes for
// damage-deduction settle/respond, negotiation accept/reject, and
// conditional-survey action-plan approval. Loopback-dispatched so the
// same auth + RLS + audit + kill-switch guards apply.
import { CHAT_KING_TOOLS } from './chat-king-tools.js';
// Wave OWNER-OS — server-side tab persistence brain tools
// (`bossnyumba.owner.tabs.spawn/close/update`). Owner + admin persona.
// MEDIUM-stakes WRITE; loopback through /api/v1/owner/tabs.
import { OWNER_TABS_TOOLS } from './owner-tabs-tools.js';
// Wave OWNER-OS — admin-platform-portal four-eye superpowers brain
// tools (`bossnyumba.admin.superpowers.bulk_action/approve/reject/
// list_pending`). ADMIN persona ONLY; HIGH-stakes; carry
// requiresPolicyRuleLiteral=true per CLAUDE.md hard rule. Loopback
// through /api/v1/admin/superpowers/*.
import { ADMIN_SUPERPOWERS_TOOLS } from './admin-superpowers-tools.js';
// Wave MD-INTELLIGENCE — the "AI Managing Director" cross-domain
// analytics pack. Four LOW-stakes read-only tools (md.correlation_for_
// question / md.trace_causes / md.compare_baselines / md.emit_insights)
// over the pure-functional real-estate signal graph in
// services/api-gateway/src/services/md-intelligence/. Owner persona
// (T1) only; loopback-dispatched to /api/v1/md/*. Ported from Borjie
// and retargeted mining → real estate (arrears ↔ rent ↔ leasing ↔
// maintenance ↔ compliance ↔ treasury ↔ occupancy ↔ …).
import { MD_INTELLIGENCE_TOOLS } from './md-intelligence-tools.js';
// Wave MULTI-UNDO — chain-undo brain tools (`undo.last_n` reverses the
// last N reversible writes LIFO; `undo.by_id` reverses a specific
// journal row). Lift of the single-step `bossnyumba.ui.undo_last_action`
// superpower. Loopback through the existing /api/v1/owner/undo-journal
// routes (undo-last + undo-by-id already shipped). Owner (T1) + admin
// (T2) personas; MEDIUM-stakes WRITE. Ported from Borjie's
// undo-chain-tools.ts (domain-neutral — only example copy retargeted).
import { UNDO_CHAIN_TOOLS } from './undo-chain-tools.js';
// Wave SOVEREIGN-ADMIN — 8 HIGH-risk inviolable-rule chat tools
// (admin.killswitch.open/close, admin.four_eye.initiate/approve,
// admin.policy.edit_rule, admin.feature_flag.set, admin.audit.export,
// admin.tenant.suspend). T2 admin persona ONLY; every tool carries
// requiresPolicyRuleLiteral=true per CLAUDE.md hard rule. four_eye.approve
// loopback-dispatches to /admin/superpowers/approve/:journalId and
// audit.export probes /admin/audit/log; feature_flag.set + tenant.suspend
// emit chips carrying BN's canonical PUT/DELETE paths; killswitch.open/
// close, four_eye.initiate, policy.edit_rule are honest-degraded (BN
// exposes those via the kernel HQ tools / admin-superpowers queue, not a
// matching REST surface — never fabricated). Ported from Borjie.
import { ADMIN_INVIOLABLE_TOOLS } from './admin-inviolable-tools.js';
// Wave COOPERATIVE-SETTLEMENT — housing-cooperative period settlement
// brain tools (`cooperative.draft_settlement` WRITE +
// `cooperative.member_share` / `cooperative.settlement_period_list`
// READ). T1 owner persona; loopback through
// /api/v1/cooperatives/settlement-periods (migration 0304). draft is
// MEDIUM-stakes WRITE; calculate/approve/distribute stay on the explicit
// route since distribute crosses the four-eye gate and posts through
// LedgerService.post(). Ported from Borjie + retargeted mining → real
// estate; the member_share read hits the real members endpoint (Borjie's
// was a TODO returning []).
import { COOPERATIVE_TOOLS } from './cooperative-tools.js';
// Gap-12 (BN half) — set-chat-mode active brain tool. One LOW-stakes
// read-only tool (`mwikila.training.set_chat_mode`) that lets the brain
// SIGNAL the pedagogical chat surface (packages/chat-ui/src/chat-modes/)
// to transition between conversation / teaching / quiz / discussion /
// review / classroom WITHOUT page navigation — giving the previously
// passive QuizLockdownOverlay (+ siblings) a deterministic trigger.
// T1 owner + T2 admin + T3 module-manager personas (the training
// drivers). No money path, no DB write, no audit chain; honest-degrade
// (echoes the requested mode + bilingual EN+SW directive, never
// fabricates a hidden side effect). Ported from LitFin's set-chat-mode
// action tool and mirrored from the Borjie sibling.
import { SET_CHAT_MODE_TOOLS } from './set-chat-mode-tools.js';
// Gap-4 (a) — geo / geofencing brain tools. Five LOW-stakes read-only
// tools (`property.geo.unit.nearby` / `title.contains` / `hazard.proximity`
// / `compliance.zone_of` / `route.optimize`) ported from Borjie's geo-
// tools.ts and retargeted mining → real estate (site/pit/region →
// property/unit/block; licence polygon → parcel/title boundary; PCCB/NEMC/
// EITI zone → planning/zoning authority area). HONEST-DEGRADED: BN does not
// yet expose the per-property map loopback routes, so every tool returns a
// typed `available:false` shape (never fabricates a parcel / hazard /
// zone). A single `MAP_ROUTES_WIRED` flag in geo-tools.ts activates the
// real loopback once the routes land.
import { GEO_TOOLS } from './geo-tools.js';
// Gap-4 (b) — scope roll-up brain tools. Five LOW-stakes read-only tools
// (`property.scope.resolve_label` / `roll_up_across_scopes` /
// `compare_across_scopes` / `cross_domain_scope_matrix` /
// `taxonomy_display_for`) ported from Borjie's scope-tools.ts and
// retargeted mining → real estate (pit/site/region scope kinds ->
// building/unit/block/portfolio; production roll-ups -> occupancy /
// maintenance-cost / rent-collected by metricId). T1 owner + T2 admin.
// Money roll-ups carry a `currency` field (never a hard-coded code).
// HONEST-DEGRADED: BN does not yet expose /property/scope/* routes, so
// each tool returns a typed `available:false` shape (resolve_label +
// taxonomy still return built-in default EN/SW labels). A single
// `SCOPE_ROUTES_WIRED` flag in scope-tools.ts activates the real loopback.
import { SCOPE_TOOLS } from './scope-tools.js';
// Gap-4 (c) — property insurance brain tools. Four tools
// (`property.insurance.get_quotes` + `bind_policy` WRITE MEDIUM-stakes;
// `policy_status` + `renewals_due` READ LOW) ported from Borjie's
// insurance-tools.ts and retargeted mining → real estate (coverage types
// workforce/plant/environmental/... -> buildings/contents/
// public_liability/loss_of_rent/landlord_liability/tenant_default). T1
// owner persona. Money fields carry an explicit `currency` (Borjie's *Tzs
// names dropped — currency-neutral). WRITE tools wrap provenance via
// withChatProvenance. HONEST-DEGRADED: BN does not yet expose
// /property/insurance/* routes, so each tool returns a typed
// `available:false` shape (never fabricates a quote / policy); a single
// `INSURANCE_ROUTES_WIRED` flag activates the real loopback + provenance.
import { INSURANCE_TOOLS } from './insurance-tools.js';

export type AnyPersonaToolDescriptor = PersonaToolDescriptor<
  z.ZodTypeAny,
  z.ZodTypeAny
>;

export interface BuildPersonaToolHandlersOptions {
  /**
   * Invoked when the same tool id appears in more than one source list.
   * Defaults to a no-op so production boot stays silent; tests can hook
   * the callback to fail loudly.
   */
  readonly onDuplicate?: (toolId: string) => void;
  /** Optional `now()` injection for deterministic audit timestamps. */
  readonly now?: () => string;
}

/**
 * Build the complete, deduplicated list of persona-aware brain
 * tool handlers. The returned array is frozen so callers can rely on
 * stable identity across registrations.
 */
export function buildPersonaToolHandlers(
  gate: PersonaToolGate,
  options?: BuildPersonaToolHandlersOptions,
): ReadonlyArray<ToolHandler> {
  const merged = mergeDescriptors(
    [
      CAPABILITY_TOOLS,
      JURISDICTION_DISCOVERY_TOOLS,
      JURISDICTION_TOOLS,
      REASON_STRATEGIZE_TOOLS,
      ENTITY_LEGIBILITY_TOOLS,
      DECISION_JOURNAL_TOOLS,
      LEASE_HISTORY_TOOLS,
      RENT_PAYOUT_TOOLS,
      OWNER_PROPERTY_TOOLS,
      OWNER_ESTATE_TOOLS,
      MANAGER_TOOLS,
      STAFF_TOOLS,
      TENANT_TOOLS,
      OPPORTUNITY_SCANNER_TOOLS,
      RISK_SCANNER_TOOLS,
      SUPERPOWERS_TOOLS,
      CHAT_KING_TOOLS,
      OWNER_TABS_TOOLS,
      ADMIN_SUPERPOWERS_TOOLS,
      MD_INTELLIGENCE_TOOLS,
      UNDO_CHAIN_TOOLS,
      ADMIN_INVIOLABLE_TOOLS,
      COOPERATIVE_TOOLS,
      SET_CHAT_MODE_TOOLS,
      GEO_TOOLS,
      SCOPE_TOOLS,
      INSURANCE_TOOLS,
    ],
    options?.onDuplicate,
  );

  // Kill-switch fail-closed: when the switch is open we return an empty
  // catalog so the brain has nothing to call. The per-tool execute hook
  // also refuses for defense in depth, but starting from `[]` makes the
  // intent unambiguous to every downstream consumer (tests, UI counters,
  // metrics).
  if (gate.killSwitchOpen) {
    return Object.freeze([]);
  }

  const handlers = merged.map((descriptor) =>
    toBrainToolHandler(descriptor, gate, {
      ...(options?.now !== undefined && { now: options.now }),
    }),
  );
  return Object.freeze(handlers);
}

/**
 * Return the unwrapped descriptor list — useful for tests / catalog
 * audits that need access to the persona metadata before the orchestrator
 * adapter wraps them.
 */
export function listPersonaToolDescriptors(): ReadonlyArray<AnyPersonaToolDescriptor> {
  return mergeDescriptors(
    [
      CAPABILITY_TOOLS,
      JURISDICTION_DISCOVERY_TOOLS,
      JURISDICTION_TOOLS,
      REASON_STRATEGIZE_TOOLS,
      ENTITY_LEGIBILITY_TOOLS,
      DECISION_JOURNAL_TOOLS,
      LEASE_HISTORY_TOOLS,
      RENT_PAYOUT_TOOLS,
      OWNER_PROPERTY_TOOLS,
      OWNER_ESTATE_TOOLS,
      MANAGER_TOOLS,
      STAFF_TOOLS,
      TENANT_TOOLS,
      OPPORTUNITY_SCANNER_TOOLS,
      RISK_SCANNER_TOOLS,
      SUPERPOWERS_TOOLS,
      CHAT_KING_TOOLS,
      OWNER_TABS_TOOLS,
      ADMIN_SUPERPOWERS_TOOLS,
      MD_INTELLIGENCE_TOOLS,
      UNDO_CHAIN_TOOLS,
      ADMIN_INVIOLABLE_TOOLS,
      COOPERATIVE_TOOLS,
      SET_CHAT_MODE_TOOLS,
      GEO_TOOLS,
      SCOPE_TOOLS,
      INSURANCE_TOOLS,
    ],
    undefined,
  );
}

function mergeDescriptors(
  lists: ReadonlyArray<ReadonlyArray<AnyPersonaToolDescriptor>>,
  onDuplicate: ((toolId: string) => void) | undefined,
): ReadonlyArray<AnyPersonaToolDescriptor> {
  const seen = new Set<string>();
  const out: AnyPersonaToolDescriptor[] = [];
  for (const list of lists) {
    for (const descriptor of list) {
      if (seen.has(descriptor.id)) {
        onDuplicate?.(descriptor.id);
        continue;
      }
      seen.add(descriptor.id);
      out.push(descriptor);
    }
  }
  return Object.freeze(out);
}

// Re-export for ergonomic imports.
export {
  toBrainToolHandler,
  type PersonaToolDescriptor,
  type PersonaToolGate,
  type PersonaToolHandlerContext,
  type PersonaToolAuditSink,
  type PersonaToolAuditEntry,
  type PersonaToolHttpClient,
  PERSONA_SLUGS,
} from './types.js';
export {
  CAPABILITY_TOOLS,
  whatCanYouDoTool,
  aboutTool,
} from './capability-tools.js';
export {
  JURISDICTION_TOOLS,
  jurisdictionShowCurrentTool,
  configureJurisdictionTools,
} from './jurisdiction-tools.js';
export {
  JURISDICTION_DISCOVERY_TOOLS,
  jurisdictionDiscoverTool,
  jurisdictionSwitchTool,
} from './jurisdiction-discovery-tools.js';
export {
  REASON_STRATEGIZE_TOOLS,
  reasonStrategizeTool,
} from './reason-strategize-tool.js';
export {
  ENTITY_LEGIBILITY_TOOLS,
  entityResolveTool,
  entityFullPictureTool,
  entityRecentTool,
  entitySearchTool,
  entityTraceTool,
  entityDeduplicateTool,
} from './entity-legibility-tools.js';
export {
  DECISION_JOURNAL_TOOLS,
  decisionsRecentTool,
  decisionsExplainTool,
  decisionsSearchTool,
  decisionsReplayTool,
  decisionsWhatDidIDecideTool,
  decisionsSuccessRateTool,
  configureDecisionJournalTools,
  __resetDecisionJournalToolsForTests,
} from './decision-journal-tools.js';
export {
  LEASE_HISTORY_TOOLS,
  leaseHistoryAppendStepTool,
  leaseHistoryShowTraceTool,
} from './lease-history-tools.js';
export {
  RENT_PAYOUT_TOOLS,
  ownerRentPayoutListMineTool,
} from './rent-payout-tools.js';
export { OWNER_PROPERTY_TOOLS } from './owner-property-tools.js';
export {
  OWNER_ESTATE_TOOLS,
  estateNetWorthSummaryTool,
  estateLookupEntityTool,
  estateIntercompanyFlowTool,
  estateSuccessionReviewTool,
  estateAssetRegisterBrowseTool,
} from './owner-estate-tools.js';
export { MANAGER_TOOLS } from './manager-tools.js';
export { STAFF_TOOLS } from './staff-tools.js';
export { TENANT_TOOLS } from './tenant-tools.js';
export {
  OPPORTUNITY_SCANNER_TOOLS,
  opportunityScanTool,
  opportunityListRulesTool,
  configureOpportunityScannerTools,
  type ScanStateBuilder,
} from './opportunity-scanner-tools.js';
export {
  RISK_SCANNER_TOOLS,
  riskScanTool,
  riskListRulesTool,
  configureRiskScannerTools,
} from './risk-scanner-tools.js';
// Chat-King wave — re-exports for tests + audit walker.
export {
  CHAT_KING_TOOLS,
  ownerDamageDeductionSettleTool,
  ownerDamageDeductionRespondTool,
  ownerNegotiationAcceptTool,
  ownerNegotiationRejectTool,
  ownerConditionalSurveyApprovePlanTool,
} from './chat-king-tools.js';
// Wave MD-INTELLIGENCE — re-exports for tests + audit walker.
export {
  MD_INTELLIGENCE_TOOLS,
  mdCorrelationForQuestionTool,
  mdTraceCausesTool,
  mdCompareBaselinesTool,
  mdEmitInsightsTool,
} from './md-intelligence-tools.js';
// Wave MULTI-UNDO — re-exports for tests + audit walker.
export {
  UNDO_CHAIN_TOOLS,
  undoLastNTool,
  undoByIdTool,
} from './undo-chain-tools.js';
// Wave SOVEREIGN-ADMIN — re-exports for tests + audit walker.
export {
  ADMIN_INVIOLABLE_TOOLS,
  adminKillSwitchOpenTool,
  adminKillSwitchCloseTool,
  adminFourEyeInitiateTool,
  adminFourEyeApproveTool,
  adminPolicyEditRuleTool,
  adminFeatureFlagSetTool,
  adminAuditExportTool,
  adminTenantSuspendTool,
} from './admin-inviolable-tools.js';
// Wave COOPERATIVE-SETTLEMENT — re-exports for tests + audit walker.
export {
  COOPERATIVE_TOOLS,
  cooperativeDraftSettlementTool,
  cooperativeMemberShareTool,
  cooperativeSettlementPeriodListTool,
} from './cooperative-tools.js';
// Gap-12 (BN half) — set-chat-mode re-exports for tests + audit walker.
export {
  SET_CHAT_MODE_TOOLS,
  setChatModeTool,
} from './set-chat-mode-tools.js';
// Gap-4 (a) — geo / geofencing re-exports for tests + audit walker.
export {
  GEO_TOOLS,
  geoPropertyNearbyTool,
  geoTitleContainsTool,
  geoHazardProximityTool,
  geoComplianceZoneTool,
  geoRouteOptimizeTool,
} from './geo-tools.js';
// Gap-4 (b) — scope roll-up re-exports for tests + audit walker.
export {
  SCOPE_TOOLS,
  scopeResolveLabelTool,
  scopeRollUpTool,
  scopeCompareTool,
  scopeCrossDomainMatrixTool,
  scopeTaxonomyDisplayTool,
} from './scope-tools.js';
// Gap-4 (c) — property insurance re-exports for tests + audit walker.
export {
  INSURANCE_TOOLS,
  insuranceGetQuotesTool,
  insuranceBindPolicyTool,
  insurancePolicyStatusTool,
  insuranceRenewalsDueTool,
} from './insurance-tools.js';
