/**
 * Checkpoint gates — per-action-class human-in-the-loop policy.
 *
 * Six action classes (R2 #15):
 *   - `send-external-comm` — SMS / Email / WhatsApp / Voice. Owner can
 *                            require approval per send or per batch.
 *   - `charge-payment`      — card debits, ACH pulls, M-Pesa STK push.
 *                             Always-ask is the recommended default.
 *   - `public-content`      — review responses, social posts.
 *   - `legal-document`      — notices, leases, court filings.
 *   - `bulk-mutation`       — any action that mutates >N entities at once
 *                             (default N=10). The threshold IS the gate.
 *   - `cross-tenant-read`   — admin-only; surfaces to a sovereign-ledger
 *                             entry on every invocation.
 *
 * Per-class config: { alwaysAsk, askThreshold?, fourEye?, autoBelow? }
 *
 *   - alwaysAsk    — if true, every action of this class requires approval
 *   - askThreshold — if set, ask only when batch size ≥ threshold
 *   - fourEye      — if true, the approver MUST differ from the initiator
 *   - autoBelow    — auto-approve when batch size < autoBelow (mutually
 *                    exclusive with alwaysAsk; if both set, alwaysAsk wins)
 */

/** Stable action-class identifiers. UI labels localised separately. */
export type ActionClass =
  | 'send-external-comm'
  | 'charge-payment'
  | 'public-content'
  | 'legal-document'
  | 'bulk-mutation'
  | 'cross-tenant-read';

/** Per-class config — owner sets these in the settings page (J9 wires later). */
export interface CheckpointGateConfig {
  readonly actionClass: ActionClass;
  /** If true, every action of this class needs approval. */
  readonly alwaysAsk: boolean;
  /** If set, ask only when batch size meets-or-exceeds this. */
  readonly askThreshold?: number;
  /** If true, the approver must be a distinct human from the initiator. */
  readonly fourEye?: boolean;
  /** If set, auto-approve batches strictly smaller than this. */
  readonly autoBelow?: number;
}

/** A request the brain sends to the gate evaluator at pre-tool-use time. */
export interface GateRequest {
  readonly actionClass: ActionClass;
  readonly tenantId: string;
  readonly initiatorUserId?: string;
  readonly batchSize?: number;
  /** If a candidate approver is already known, supply it here. */
  readonly proposedApproverUserId?: string;
}

/**
 * Verdict from gate evaluation.
 *   - `auto-approve` — gate passes without human action
 *   - `request-approval` — brain must pause and request approval
 *   - `deny` — gate refuses (e.g. four-eye violated)
 */
export type GateVerdict =
  | { readonly outcome: 'auto-approve'; readonly actionClass: ActionClass; readonly reason: string }
  | {
      readonly outcome: 'request-approval';
      readonly actionClass: ActionClass;
      readonly fourEye: boolean;
      readonly reason: string;
    }
  | { readonly outcome: 'deny'; readonly actionClass: ActionClass; readonly reason: string };

/** Per-tenant settings — the owner's settings page produces this object. */
export interface TenantGateSettings {
  readonly tenantId: string;
  readonly gates: Readonly<Record<ActionClass, CheckpointGateConfig>>;
}

/** Storage port — abstracted so the package has no DB dependency. */
export interface GateSettingsStore {
  loadSettings(tenantId: string): Promise<TenantGateSettings>;
  saveSettings(settings: TenantGateSettings): Promise<void>;
}
