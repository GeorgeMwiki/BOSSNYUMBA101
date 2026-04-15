/**
 * Shared types for retention entity adapters.
 *
 * Every entity we retain (audit_events, chat_messages, etc.) is backed by
 * one of these adapters. The worker loops over the registry, hands each
 * adapter the cutoff date, and collects the result metrics. Adapters
 * encapsulate the "how" (which table, soft vs hard delete, legal_hold
 * filter) while the worker drives the "when".
 */

export interface AdapterRunOptions {
  /** Records created/occurred on or before this date are candidates. */
  cutoff: Date;
  /** When true, count candidates but do NOT modify the database. */
  dryRun: boolean;
  /** Upper bound on rows touched per invocation. */
  batchLimit: number;
}

export interface AdapterResult {
  entity: string;
  /** Rows matching the cutoff before legal-hold filtering. */
  candidates: number;
  /** Rows actually soft-deleted or purged. */
  affected: number;
  /** Rows skipped because of legal hold. */
  skippedLegalHold: number;
  /** Non-fatal issues (e.g. table missing). */
  warnings: string[];
  /** Whether the adapter ran successfully end-to-end. */
  ok: boolean;
  /** Fatal error message, if any. */
  error?: string;
  /** Wall-clock milliseconds. */
  durationMs: number;
}

export interface RetentionAdapter {
  /** Stable identifier used in logs and metrics. */
  readonly name: string;
  /** Retention window in days (informational; worker computes cutoff). */
  readonly retentionDays: number;
  /**
   * Execute the retention pass for this entity.
   * MUST be idempotent: calling twice with the same cutoff should not
   * double-delete. MUST honour legal_hold flags. MUST log and return
   * cleanly (not throw) when the backing table is missing.
   */
  run(options: AdapterRunOptions): Promise<AdapterResult>;
}
