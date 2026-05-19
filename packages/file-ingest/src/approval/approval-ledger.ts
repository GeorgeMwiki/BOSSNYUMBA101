/**
 * The 4-eye approval rule:
 *
 *   1. PROPOSER builds the IngestPlan ("first pair of eyes").
 *   2. A DIFFERENT actor must record an approval ("second pair of eyes").
 *   3. Only an APPROVED plan can be executed.
 *
 * The ledger keeps the audit trail. It is intentionally simple (in-memory)
 * but exposes a stable interface so production wiring can drop in a
 * persistent backend.
 */

import type { ApprovalRecord, ApprovalState, IngestPlan } from './types.js';

export class ApprovalRuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalRuleViolationError';
  }
}

interface LedgerEntry {
  readonly plan: IngestPlan;
  readonly proposer_id: string;
  readonly records: ReadonlyArray<ApprovalRecord>;
  readonly state: ApprovalState;
}

export class ApprovalLedger {
  private entries: ReadonlyMap<string, LedgerEntry>;

  constructor() {
    this.entries = new Map();
  }

  /** Register a freshly-built plan. The proposer_id is "first pair of eyes". */
  propose(plan: IngestPlan, proposerId: string): ApprovalRecord {
    if (this.entries.has(plan.ingest_plan_id)) {
      throw new ApprovalRuleViolationError(
        `Plan ${plan.ingest_plan_id} already exists in ledger; build a new plan id instead.`
      );
    }
    const record: ApprovalRecord = Object.freeze({
      ingest_plan_id: plan.ingest_plan_id,
      state: 'proposed',
      actor_id: proposerId,
      at: new Date().toISOString(),
    });
    const next = new Map(this.entries);
    next.set(plan.ingest_plan_id, {
      plan,
      proposer_id: proposerId,
      records: [record],
      state: 'proposed',
    });
    this.entries = next;
    return record;
  }

  /**
   * Record an approval. Throws if:
   *   - plan id unknown
   *   - actor is the same as the proposer (4-eye violation)
   *   - plan is not in 'proposed' state
   */
  approve(planId: string, actorId: string, comment?: string): ApprovalRecord {
    const entry = this.entries.get(planId);
    if (!entry) {
      throw new ApprovalRuleViolationError(`Plan ${planId} not in ledger`);
    }
    if (entry.state !== 'proposed') {
      throw new ApprovalRuleViolationError(
        `Plan ${planId} cannot be approved from state "${entry.state}"`
      );
    }
    if (entry.proposer_id === actorId) {
      throw new ApprovalRuleViolationError(
        `4-eye violation: ${actorId} both proposed and tried to approve plan ${planId}`
      );
    }
    const record: ApprovalRecord = Object.freeze({
      ingest_plan_id: planId,
      state: 'approved',
      actor_id: actorId,
      ...(comment !== undefined ? { comment } : {}),
      at: new Date().toISOString(),
    });
    const next = new Map(this.entries);
    next.set(planId, {
      ...entry,
      records: [...entry.records, record],
      state: 'approved',
    });
    this.entries = next;
    return record;
  }

  /** Mark a plan rejected. The rejecter still must be a different actor from the proposer. */
  reject(planId: string, actorId: string, comment?: string): ApprovalRecord {
    const entry = this.entries.get(planId);
    if (!entry) {
      throw new ApprovalRuleViolationError(`Plan ${planId} not in ledger`);
    }
    if (entry.state !== 'proposed') {
      throw new ApprovalRuleViolationError(
        `Plan ${planId} cannot be rejected from state "${entry.state}"`
      );
    }
    if (entry.proposer_id === actorId) {
      throw new ApprovalRuleViolationError(
        `4-eye violation: ${actorId} both proposed and tried to reject plan ${planId}`
      );
    }
    const record: ApprovalRecord = Object.freeze({
      ingest_plan_id: planId,
      state: 'rejected',
      actor_id: actorId,
      ...(comment !== undefined ? { comment } : {}),
      at: new Date().toISOString(),
    });
    const next = new Map(this.entries);
    next.set(planId, {
      ...entry,
      records: [...entry.records, record],
      state: 'rejected',
    });
    this.entries = next;
    return record;
  }

  /** Mark a plan executed. Called by the executor on successful completion. */
  markExecuted(planId: string, actorId: string): ApprovalRecord {
    const entry = this.entries.get(planId);
    if (!entry) {
      throw new ApprovalRuleViolationError(`Plan ${planId} not in ledger`);
    }
    if (entry.state !== 'approved') {
      throw new ApprovalRuleViolationError(
        `Plan ${planId} cannot be executed from state "${entry.state}"`
      );
    }
    const record: ApprovalRecord = Object.freeze({
      ingest_plan_id: planId,
      state: 'executed',
      actor_id: actorId,
      at: new Date().toISOString(),
    });
    const next = new Map(this.entries);
    next.set(planId, {
      ...entry,
      records: [...entry.records, record],
      state: 'executed',
    });
    this.entries = next;
    return record;
  }

  getState(planId: string): ApprovalState | null {
    return this.entries.get(planId)?.state ?? null;
  }

  getRecords(planId: string): ReadonlyArray<ApprovalRecord> {
    return this.entries.get(planId)?.records ?? [];
  }

  /** True iff plan exists and is in 'approved' state (executor pre-check). */
  isApproved(planId: string): boolean {
    return this.getState(planId) === 'approved';
  }
}
