/**
 * PI-A · soft-delete — guard rails for deletion.
 *
 * Every "delete" is a soft-delete: sets `deleted_at`, `deleted_by`,
 * `delete_reason`. The row stays in the table. `undoDelete()` clears
 * `deleted_at` within a retention window (default 30 days). After the
 * window expires, undoDelete rejects with RetentionExpiredError.
 *
 * Per-entity-kind retention overrides come from JurisdictionalRules. The
 * defaults are:
 *
 *   lease          → 2555 days (≈ 7 years, KE Evidence Act + tenancy-law floor)
 *   kra_filing     → 2555 days (KRA record retention)
 *   payroll_record → 2555 days (KE Employment Act)
 *   property       → 2555 days (legal title evidence)
 *   employee       → 1095 days (3 yr post-separation HR retention)
 *   customer       → 1095 days (commercial-record retention)
 *   vendor         → 1095 days
 *   default        → 30 days   (PII / day-to-day data)
 *
 * `purgeExpired()` is the cron job that physically removes rows whose
 * `deleted_at + retentionDays < now`. Each purge writes a
 * `purge_certificate` to the sovereign action ledger (K-E audit-everything
 * principle). The certificate is the ONLY record after the row is gone, so
 * it is irrevocable and signed (impl detail at adapter layer).
 */

export interface SoftDeleteRow {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly deletedAt: string | null; // ISO-8601 or null when alive
  readonly deletedBy: string | null;
  readonly deleteReason: string | null;
}

export interface SoftDeleteInput {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly actor: { readonly kind: 'owner' | 'employee' | 'agent' | 'system'; readonly id: string };
  readonly reason: string;
  /** Optional override; usually resolved from JurisdictionalRules. */
  readonly retentionDays?: number;
}

export interface UndoDeleteInput {
  readonly tenantId: string;
  readonly entityId: string;
  readonly actor: { readonly kind: 'owner' | 'employee' | 'agent' | 'system'; readonly id: string };
  readonly reason: string;
}

export interface PurgeCertificate {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly deletedAt: string;
  readonly purgedAt: string;
  readonly retentionDays: number;
  /** Hash of the certificate row content — for the ledger's append-only chain. */
  readonly certificateHash: string;
}

export class RetentionExpiredError extends Error {
  public constructor(entityId: string, deletedAt: string, retentionDays: number) {
    super(
      `RetentionExpiredError: undo denied — entity ${entityId} was soft-deleted at ${deletedAt} (retention ${retentionDays}d expired)`,
    );
    this.name = 'RetentionExpiredError';
  }
}

export class NotDeletedError extends Error {
  public constructor(entityId: string) {
    super(`NotDeletedError: cannot undo — entity ${entityId} is not soft-deleted`);
    this.name = 'NotDeletedError';
  }
}

/**
 * Default per-entity-kind retention windows in days. Read by the soft-delete
 * module via `resolveRetentionDays()`. JurisdictionalRules can override
 * per-tenant via the same lookup function.
 */
export const DEFAULT_RETENTION_DAYS: Readonly<Record<string, number>> = Object.freeze({
  lease: 2555,
  kra_filing: 2555,
  payroll_record: 2555,
  property: 2555,
  employee: 1095,
  customer: 1095,
  vendor: 1095,
  default: 30,
});

/**
 * Resolve retention days for an entity kind, falling back to default.
 *
 * An override of `undefined` means "no override — use the default table".
 * An override of `0` is explicit immediate-expiry (used by tests + the
 * "delete-now" admin action). Negative numbers are rejected.
 */
export function resolveRetentionDays(entityKind: string, override?: number): number {
  if (typeof override === 'number') {
    if (override < 0) throw new Error(`resolveRetentionDays: override must be ≥ 0 (got ${override})`);
    return override;
  }
  return DEFAULT_RETENTION_DAYS[entityKind] ?? DEFAULT_RETENTION_DAYS['default']!;
}
