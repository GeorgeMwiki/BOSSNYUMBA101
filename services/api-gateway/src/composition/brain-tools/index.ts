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
// PT-A — Owner persona property tools (42 tools covering cockpit reads
// + lease lifecycle + delinquency + payroll + delegation + regulator
// disclosure + signed condition reports). Real-estate retailoring of
// Borjie's owner-tools.ts + owner-estate-tools.ts + companion catalogs.
import { OWNER_PROPERTY_TOOLS } from './owner-property-tools.js';
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
      OWNER_PROPERTY_TOOLS,
      MANAGER_TOOLS,
      STAFF_TOOLS,
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
      OWNER_PROPERTY_TOOLS,
      MANAGER_TOOLS,
      STAFF_TOOLS,
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
export { OWNER_PROPERTY_TOOLS } from './owner-property-tools.js';
export { MANAGER_TOOLS } from './manager-tools.js';
export { STAFF_TOOLS } from './staff-tools.js';
