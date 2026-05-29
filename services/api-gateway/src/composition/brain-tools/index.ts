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
