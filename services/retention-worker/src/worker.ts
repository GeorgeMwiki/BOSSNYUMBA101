/**
 * Retention Sweep Worker
 *
 * Executes a single pass over every enabled retention policy defined in
 * `@bossnyumba/enterprise-hardening`. For each policy it:
 *
 *   1. Asks the repository for records older than the policy's
 *      `retentionPeriodDays`.
 *   2. Filters out anything that has a row-level `legal_hold: true` flag
 *      OR appears in the separate `legal_holds` registry table.
 *   3. In dry-run mode, logs what would be removed.
 *   4. In live mode, performs a soft-delete (default) or hard-delete
 *      (for policies opted in via options).
 *   5. Writes a single audit log entry describing the sweep, including
 *      per-policy counts and how many records were exempted by legal hold.
 *
 * The guarantee: a record under legal hold is NEVER touched, regardless
 * of age or policy type. This is enforced in two layers — the repository
 * surfaces the row-level flag, and the worker cross-checks the hold
 * registry before any delete is issued.
 */

import {
  DataRetentionManager,
  type RetentionPolicy,
} from '@bossnyumba/enterprise-hardening';

import { createLogger, type Logger } from './logger.js';
import type {
  PolicyRunResult,
  RetentionCandidate,
  RetentionRepository,
  RunRetentionSweepOptions,
  SweepResult,
} from './types.js';

export interface RetentionWorkerDeps {
  readonly repository: RetentionRepository;
  readonly manager?: DataRetentionManager;
  readonly logger?: Logger;
}

/**
 * Utility: generate a sweep id without pulling in a uuid dependency.
 * `crypto.randomUUID` is available in Node 18+.
 */
function newSweepId(): string {
  return `sweep_${globalThis.crypto.randomUUID()}`;
}

/**
 * Compute the cutoff date for a policy. Anything created before the cutoff
 * is considered expired by that policy.
 */
export function cutoffFor(policy: RetentionPolicy, now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - policy.retentionPeriodDays);
  return cutoff;
}

/**
 * Run a single retention sweep.
 *
 * This function is pure with respect to its dependencies: everything it
 * talks to (DB, clock, logger, policy manager) is injected, which is why
 * the test suite can exercise it in-memory.
 */
export async function runRetentionSweep(
  deps: RetentionWorkerDeps,
  options: RunRetentionSweepOptions = {},
): Promise<SweepResult> {
  const logger = deps.logger ?? createLogger('retention-worker');
  const manager = deps.manager ?? new DataRetentionManager();
  const { repository } = deps;

  const dryRun = options.dryRun ?? false;
  const now = options.now ?? new Date();
  const sweepId = newSweepId();
  const startedAt = now.toISOString();

  const allPolicies = manager
    .exportPolicies()
    .filter((p) => p.enabled)
    .filter((p) => !options.policyIds || options.policyIds.includes(p.id));

  logger.info('retention sweep starting', {
    sweepId,
    dryRun,
    policyCount: allPolicies.length,
    cutoffNow: startedAt,
  });

  const perPolicyResults: PolicyRunResult[] = [];
  let totalDeleted = 0;
  let totalExcluded = 0;

  for (const policy of allPolicies) {
    const cutoff = cutoffFor(policy, now);
    const entityTypes = policy.appliesTo.map((s) => s.entityType);

    let candidatesFound = 0;
    let deleted = 0;
    let excludedByLegalHold = 0;
    const errors: string[] = [];

    for (const entityType of entityTypes) {
      try {
        const candidates = await repository.findCandidates({
          entityType,
          olderThan: cutoff,
        });
        candidatesFound += candidates.length;

        if (candidates.length === 0) {
          continue;
        }

        // Layer 1: row-level `legal_hold: true` flag.
        const rowLevelHeld: RetentionCandidate[] = [];
        const notRowHeld: RetentionCandidate[] = [];
        for (const c of candidates) {
          if (c.legalHold === true) {
            rowLevelHeld.push(c);
          } else {
            notRowHeld.push(c);
          }
        }

        // Layer 2: cross-check the `legal_holds` registry table.
        const heldIds = await repository.findLegalHoldEntityIds({
          entityType,
          entityIds: notRowHeld.map((c) => c.entityId),
        });

        // Layer 3: cross-check the in-memory DataRetentionManager holds
        // (covers holds loaded at app startup that are not yet persisted).
        const eligible = notRowHeld.filter((c) => {
          if (heldIds.has(c.entityId)) return false;
          const { held } = manager.isUnderLegalHold(
            entityType,
            c.tenantId,
            c.createdAt,
          );
          return !held;
        });

        const excludedForThisType =
          rowLevelHeld.length + (notRowHeld.length - eligible.length);
        excludedByLegalHold += excludedForThisType;

        if (excludedForThisType > 0) {
          logger.info('retention sweep excluded records by legal hold', {
            sweepId,
            policyId: policy.id,
            entityType,
            excluded: excludedForThisType,
          });
        }

        if (eligible.length === 0) {
          continue;
        }

        if (dryRun) {
          logger.info('retention sweep dry-run would delete', {
            sweepId,
            policyId: policy.id,
            entityType,
            count: eligible.length,
            sampleIds: eligible.slice(0, 5).map((c) => c.entityId),
          });
          deleted += eligible.length;
          continue;
        }

        const useHardDelete =
          options.hardDeleteAll === true ||
          options.hardDeletePolicyIds?.includes(policy.id) === true;

        const ids = eligible.map((c) => c.entityId);
        const affected = useHardDelete
          ? await repository.hardDelete({ entityType, entityIds: ids })
          : await repository.softDelete({
              entityType,
              entityIds: ids,
              deletedAt: now,
            });

        deleted += affected;

        logger.info('retention sweep deleted records', {
          sweepId,
          policyId: policy.id,
          entityType,
          mode: useHardDelete ? 'hard' : 'soft',
          affected,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${entityType}: ${message}`);
        logger.error('retention sweep entity-type failed', {
          sweepId,
          policyId: policy.id,
          entityType,
          error: message,
        });
      }
    }

    const result: PolicyRunResult = {
      policyId: policy.id,
      policyName: policy.name,
      candidatesFound,
      deleted,
      excludedByLegalHold,
      entityTypes,
      errors,
    };
    perPolicyResults.push(result);
    totalDeleted += deleted;
    totalExcluded += excludedByLegalHold;
  }

  const completedAt = new Date().toISOString();
  const sweepResult: SweepResult = {
    sweepId,
    startedAt,
    completedAt,
    dryRun,
    policies: perPolicyResults,
    totalDeleted,
    totalExcludedByLegalHold: totalExcluded,
  };

  try {
    await repository.writeAuditLog(sweepResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('retention sweep audit log write failed', {
      sweepId,
      error: message,
    });
  }

  logger.info('retention sweep finished', {
    sweepId,
    dryRun,
    totalDeleted,
    totalExcludedByLegalHold: totalExcluded,
    policies: perPolicyResults.length,
  });

  return sweepResult;
}
