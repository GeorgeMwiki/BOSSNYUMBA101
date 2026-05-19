/**
 * PI-A · integrations — adapter surfaces for the wider substrate.
 *
 * Each surface is a narrow port the production code wires to its real
 * substrate (K-B / K-E / K-D / M-B / M-E / J9). All ports are async to
 * accommodate I/O; all return frozen, immutable structures.
 *
 *   K-B Action Receipts  → IReceiptEmitter — every auto-fill/change emits
 *                          a chat-renderable receipt block
 *   K-E Constitution     → IConstitutionGate — destructive-change gate;
 *                          wraps M-B verification for high-stakes attrs
 *   K-D Temporal KG      → ITemporalKGSync — every history entry mirrors
 *                          to the temporal-edge tables so replays can
 *                          join the broader graph
 *   M-B CoVe             → IHighStakesVerifier — runs Chain-of-Verification
 *                          before applying high-stakes attribute changes
 *                          (rent amount, lease end date, KRA-PIN)
 *   M-E Confidence       → IVerbalizedConfidenceProvider — supplies the
 *                          per-observation explicit confidence (logprob +
 *                          verbalized blend)
 *   J9 Chat Workspace    → IChatRenderSink — change-tracking blocks render
 *                          inline in the chat timeline (Action Receipt
 *                          parent component)
 *
 * The integration layer offers null-safe defaults so packages can pull in
 * progressive-intelligence without immediately needing all six substrates
 * to be live. Production wires the real impls.
 */

import type { EvidenceRef, ObservationEvent } from '../observations/types.js';
import type { AutoFillReceipt } from '../auto-fill/types.js';
import type { ChangeRecord, ConstitutionVerdict, MutationContext } from '../change-tracking/types.js';
import type { AttributeHistoryEntry } from '../history/types.js';

/** K-B — every auto-fill/change emits a receipt block. */
export interface IReceiptEmitter {
  emitAutoFillReceipt(receipt: AutoFillReceipt): Promise<void>;
  emitChangeRecord(record: ChangeRecord): Promise<void>;
}

/**
 * K-E — constitutional gate for destructive changes. Production wires
 * `enforceConstitution(actor, context, payload)` from the agent-platform
 * package; the PI-A wrapper consumes only the verdict.
 */
export interface IConstitutionGate {
  check(ctx: MutationContext, fromValue: unknown): Promise<ConstitutionVerdict>;
}

/** K-D — temporal KG sync. Every history entry mirrors a temporal edge. */
export interface ITemporalKGSync {
  syncHistoryEntry(entry: AttributeHistoryEntry): Promise<void>;
}

/**
 * M-B — high-stakes attribute verifier (CoVe). The set of high-stakes
 * attributes is closed-world (per attr-key) so the wrapper can quickly
 * decide whether to invoke verification.
 */
export interface IHighStakesVerifier {
  isHighStakes(entityKind: string, attributeKey: string): boolean;
  verify(observation: ObservationEvent, evidence: ReadonlyArray<EvidenceRef>): Promise<{
    readonly verified: boolean;
    readonly notes?: string;
  }>;
}

/** M-E — verbalized confidence provider. */
export interface IVerbalizedConfidenceProvider {
  provide(observation: ObservationEvent): Promise<number>;
}

/** J9 — render any ag-ui block inline in the chat timeline. */
export interface IChatRenderSink {
  render(block: AutoFillReceipt | ChangeRecord): Promise<void>;
}

/** Default attribute high-stakes registry — the seed list described in the spec. */
export const DEFAULT_HIGH_STAKES_ATTRS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  lease: Object.freeze(['monthly_rent', 'lease_end_date', 'security_deposit']),
  unit: Object.freeze(['monthly_rent']),
  customer: Object.freeze(['kra_pin', 'national_id', 'bank_account_number']),
  vendor: Object.freeze(['bank_account_number', 'kra_pin']),
  employee: Object.freeze(['salary', 'national_id', 'bank_account_number']),
});

export function isHighStakesAttr(entityKind: string, attributeKey: string): boolean {
  const list = DEFAULT_HIGH_STAKES_ATTRS[entityKind];
  return list?.includes(attributeKey) ?? false;
}
