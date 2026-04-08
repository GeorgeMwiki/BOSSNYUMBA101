/**
 * Retention Worker Types
 *
 * Shared types for the nightly retention sweep worker. The worker uses the
 * policy definitions from `@bossnyumba/enterprise-hardening` but talks to the
 * database through a narrow repository interface so it stays easy to test
 * and does not have to know about the underlying ORM (Drizzle/Prisma).
 */

import type {
  LegalHold,
  RetentionPolicy,
} from '@bossnyumba/enterprise-hardening';

/**
 * A retention candidate is any record that has been identified by the worker
 * as older than its policy's retention period. The repository is responsible
 * for returning these; the worker is responsible for filtering out records
 * that fall under a legal hold.
 */
export interface RetentionCandidate {
  readonly entityType: string;
  readonly entityId: string;
  readonly tenantId: string;
  readonly createdAt: string;
  /** True if the row itself has a `legal_hold` column set to true. */
  readonly legalHold?: boolean;
  /** Extra metadata useful for logging / audit. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Outcome for one policy after it has been processed by a sweep.
 */
export interface PolicyRunResult {
  readonly policyId: string;
  readonly policyName: string;
  readonly candidatesFound: number;
  readonly deleted: number;
  readonly excludedByLegalHold: number;
  readonly entityTypes: readonly string[];
  readonly errors: readonly string[];
}

/**
 * Result of a full retention sweep across all policies.
 */
export interface SweepResult {
  readonly sweepId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly dryRun: boolean;
  readonly policies: readonly PolicyRunResult[];
  readonly totalDeleted: number;
  readonly totalExcludedByLegalHold: number;
}

/**
 * Repository abstraction for the retention worker. The live wiring of this
 * interface lives outside the worker itself (we inject it from `index.ts`)
 * so the worker can be exercised with in-memory fakes in tests.
 */
export interface RetentionRepository {
  /**
   * Find records older than `olderThan` for an entity type.
   * Implementations MUST surface any `legal_hold: true` column via the
   * `legalHold` field on `RetentionCandidate` so the worker can filter them.
   */
  findCandidates(args: {
    entityType: string;
    olderThan: Date;
  }): Promise<RetentionCandidate[]>;

  /**
   * Check whether any of the provided candidates have an entry in the
   * `legal_holds` table (i.e. a separate legal-hold registry).
   * Should return the set of entity IDs that ARE held.
   */
  findLegalHoldEntityIds(args: {
    entityType: string;
    entityIds: readonly string[];
  }): Promise<Set<string>>;

  /**
   * Soft-delete (set `deletedAt`) a batch of records.
   * Returns the number of rows affected.
   */
  softDelete(args: {
    entityType: string;
    entityIds: readonly string[];
    deletedAt: Date;
  }): Promise<number>;

  /**
   * Hard-delete a batch of records. Reserved for purge-stage policies.
   * Returns the number of rows affected.
   */
  hardDelete(args: {
    entityType: string;
    entityIds: readonly string[];
  }): Promise<number>;

  /**
   * Persist an audit log entry for a completed sweep.
   */
  writeAuditLog(entry: SweepResult): Promise<void>;
}

/**
 * Options passed to `runRetentionSweep`.
 */
export interface RunRetentionSweepOptions {
  /**
   * When true, the worker logs what WOULD be deleted but does not perform
   * any deletions. The audit log still records the planned counts with the
   * `dryRun` flag set.
   */
  readonly dryRun?: boolean;
  /**
   * Override the clock (useful for tests). Defaults to `new Date()`.
   */
  readonly now?: Date;
  /**
   * Restrict the sweep to a subset of policy IDs. When omitted, every
   * enabled policy is processed.
   */
  readonly policyIds?: readonly string[];
  /**
   * When true, the worker will treat each policy as a hard-delete. Defaults
   * to soft-delete. Individual policies may opt in via
   * `hardDeletePolicyIds`.
   */
  readonly hardDeleteAll?: boolean;
  /**
   * Explicit list of policy IDs that should use hard-delete semantics.
   */
  readonly hardDeletePolicyIds?: readonly string[];
}

export type PolicyWithLegalHolds = {
  readonly policy: RetentionPolicy;
  readonly legalHolds: readonly LegalHold[];
};
