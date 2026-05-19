/**
 * Sub-MD substrate — shared types
 *
 * The substrate package introduces SIX generic primitives that the
 * existing property-bound sub-MDs (maintenance.dispatch, complaint.triage,
 * arrears.chaser, lease.coordinator, kra.filing_assistant) can be
 * decomposed into:
 *
 *   1. Triage<TInput, TClassification>     — classify-and-route
 *   2. Dispatch<TClassification, TRoute>   — pick a counterparty + send
 *   3. Draft<TInput, TDraft>               — generate a reviewable artifact
 *   4. Chase<TTarget, TEscalation>         — multi-step follow-up with escalation
 *   5. Compile<TInputs, TReport>           — aggregate signals into a report
 *   6. Reconcile<TLeftRight, TMatches>     — match two sides + flag deltas
 *
 * Each primitive is a pure function with an injected context, a permission
 * mode, an autonomy cap, and a ledger-seal port. The same substrate runs
 * BOSSNYUMBA-owner sub-MDs (property mgmt) AND BOSSNYUMBA-internal sub-MDs
 * (HR, sales, ops, finance).
 *
 * Reliability framing (R3): 0.85^10 ≈ 0.20. We never collapse N reversible
 * steps into one autonomous loop. The substrate enforces this by making
 * every primitive a single-step contract that emits a ledger entry the MD
 * can replay / reverse.
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────
// Scope — the (tenantId, ownerId?, scopeId?) bubble a sub-MD lives in.
// `scopeId` is generalised from `propertyId` so internal-admin sub-MDs
// (whose scope is org-team / department, not a property) reuse the same
// guard.
// ─────────────────────────────────────────────────────────────────────

export interface ScopeFilter {
  readonly tenantId: string;
  readonly ownerId?: string;
  /**
   * Generic scope id: `propertyId`, `departmentId`, `teamId`, …
   * Empty array = scope is the whole tenant.
   */
  readonly scopeIds?: ReadonlyArray<string>;
}

export const scopeFilterSchema = z.object({
  tenantId: z.string().min(1),
  ownerId: z.string().min(1).optional(),
  scopeIds: z.array(z.string().min(1)).readonly().optional(),
});

// ─────────────────────────────────────────────────────────────────────
// Permission mode — Claude-Code-style. Determines what the substrate
// is allowed to DO with the output of a primitive before the MD has
// reviewed it.
//
//   - `dry-run`     primitive computes but emits no side-effect ledger entry
//   - `propose`     primitive emits a draft ledger entry (status = 'draft')
//   - `act-on-yes`  primitive emits a draft + asks the owner via inbox;
//                   acts only on explicit yes
//   - `auto`        primitive acts immediately (gated by autonomy-cap)
// ─────────────────────────────────────────────────────────────────────

export type PermissionMode = 'dry-run' | 'propose' | 'act-on-yes' | 'auto';

export const permissionModeSchema = z.enum([
  'dry-run',
  'propose',
  'act-on-yes',
  'auto',
]);

// ─────────────────────────────────────────────────────────────────────
// Autonomy cap — per-primitive ceiling on how many side-effect ledger
// entries the substrate may emit in a single invocation. Mirrors
// @bossnyumba/autonomy-governance but local so the substrate stays
// dependency-free.
// ─────────────────────────────────────────────────────────────────────

export interface AutonomyCap {
  /** Max side-effecting ledger entries this primitive may emit. */
  readonly maxSideEffects: number;
  /** Max LLM calls (single-shot, no streaming). */
  readonly maxLlmCalls: number;
  /** Max external-service calls (email, SMS, CRM write). */
  readonly maxExternalCalls: number;
}

export const DEFAULT_AUTONOMY_CAP: Readonly<AutonomyCap> = Object.freeze({
  maxSideEffects: 1,
  maxLlmCalls: 2,
  maxExternalCalls: 2,
});

export const autonomyCapSchema = z.object({
  maxSideEffects: z.number().int().nonnegative(),
  maxLlmCalls: z.number().int().nonnegative(),
  maxExternalCalls: z.number().int().nonnegative(),
});

// ─────────────────────────────────────────────────────────────────────
// Ledger seal — the substrate's audit boundary. Every primitive emits
// exactly ONE LedgerEntry summarizing what it observed / classified /
// drafted / sent. The MD persists + signs the entry; the primitive
// never reaches into storage directly.
// ─────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  readonly correlationId: string;
  readonly tenantId: string;
  readonly primitiveName: string;
  readonly primitiveKind: PrimitiveKind;
  readonly emittedAtMs: number;
  readonly mode: PermissionMode;
  readonly status: LedgerStatus;
  readonly summary: string;
  readonly inputHash: string;
  readonly outputHash: string;
  /** Side-effect counter — must equal #external + #ledger entries emitted. */
  readonly sideEffectCount: number;
  readonly autonomyCapApplied: AutonomyCap;
}

export type LedgerStatus =
  | 'dry-run'
  | 'draft'
  | 'awaiting-owner'
  | 'sealed'
  | 'rejected'
  | 'reversed';

export type PrimitiveKind =
  | 'triage'
  | 'dispatch'
  | 'draft'
  | 'chase'
  | 'compile'
  | 'reconcile';

export interface LedgerSealPort {
  /**
   * Persist + cryptographically seal a ledger entry. Production wires
   * postgres + signing key; tests inject an in-memory recorder.
   */
  seal(entry: LedgerEntry): Promise<{ readonly sealedId: string }>;
}

export const ledgerEntrySchema = z.object({
  correlationId: z.string().min(1),
  tenantId: z.string().min(1),
  primitiveName: z.string().min(1),
  primitiveKind: z.enum([
    'triage',
    'dispatch',
    'draft',
    'chase',
    'compile',
    'reconcile',
  ]),
  emittedAtMs: z.number().int().nonnegative(),
  mode: permissionModeSchema,
  status: z.enum([
    'dry-run',
    'draft',
    'awaiting-owner',
    'sealed',
    'rejected',
    'reversed',
  ]),
  summary: z.string().min(1).max(400),
  inputHash: z.string().min(1),
  outputHash: z.string().min(1),
  sideEffectCount: z.number().int().nonnegative(),
  autonomyCapApplied: autonomyCapSchema,
});

// ─────────────────────────────────────────────────────────────────────
// Primitive context — what every primitive is handed at run-time.
// ─────────────────────────────────────────────────────────────────────

export interface PrimitiveContext {
  readonly scope: ScopeFilter;
  readonly nowMs: number;
  readonly correlationId: string;
  readonly mode: PermissionMode;
  readonly autonomyCap: AutonomyCap;
  readonly ledger: LedgerSealPort;
}

export interface PrimitiveResult<TOutput> {
  readonly output: TOutput;
  readonly ledgerEntry: LedgerEntry;
  readonly sealedId: string;
}

// ─────────────────────────────────────────────────────────────────────
// Defensive scope guard — refuse cross-tenant inputs.
// ─────────────────────────────────────────────────────────────────────

export type InScopeResult = { readonly ok: true } | {
  readonly ok: false;
  readonly reason: string;
};

export function isInScope(
  candidateTenantId: string,
  scope: ScopeFilter,
): InScopeResult {
  if (candidateTenantId !== scope.tenantId) {
    return {
      ok: false,
      reason: `cross-tenant input rejected (got ${candidateTenantId}, scope ${scope.tenantId})`,
    };
  }
  return { ok: true };
}
