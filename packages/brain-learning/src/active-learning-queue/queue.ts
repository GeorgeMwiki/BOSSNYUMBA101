/**
 * Active-learning queue orchestrator.
 *
 * Manages the lifecycle of items awaiting human labelling:
 *   - enqueue           (when a trigger fires on a low-confidence turn)
 *   - daily digest      (rendered through N-A's chat interface)
 *   - record decline    (anti-fatigue logic)
 *
 * Anti-fatigue caps (§6 R-LEARNING):
 *   - max 25 items / day / labeller
 *   - deprioritise after 3 declines on the same item
 */

import type {
  ActiveLearningItem,
  ActiveLearningStatus,
  ActiveLearningTrigger,
  TurnId,
} from '../types.js';
import {
  checkActiveLearningTrigger,
  type TriggerCheckInput,
} from './triggers.js';

/** Max items shown to a single labeller per day (§6 anti-fatigue). */
export const MAX_ITEMS_PER_LABELLER_PER_DAY = 25;
/** Decline count above which the item is deprioritised. */
export const DECLINE_DEPRIORITISE_THRESHOLD = 3;

/**
 * Storage port — J1 `active_learning_item` entity.
 */
export interface ActiveLearningItemStore {
  insert(item: ActiveLearningItem): Promise<void>;
  updateStatus(args: {
    tenantId: string;
    turnId: TurnId;
    status: ActiveLearningStatus;
  }): Promise<void>;
  incrementDeclineCount(args: {
    tenantId: string;
    turnId: TurnId;
  }): Promise<ActiveLearningItem | null>;
  listPending(args: {
    tenantId: string;
    limit: number;
  }): Promise<ReadonlyArray<ActiveLearningItem>>;
  countAssignedToday(args: {
    tenantId: string;
    labellerId: string;
    today: Date;
  }): Promise<number>;
}

export interface ActiveLearningPorts {
  readonly store: ActiveLearningItemStore;
  readonly clock: () => Date;
}

export interface EnqueueInput {
  readonly tenantId: string;
  readonly turnId: TurnId;
  readonly signals: TriggerCheckInput;
}

export interface EnqueueOutcome {
  readonly enqueued: boolean;
  readonly trigger: ActiveLearningTrigger | null;
}

/**
 * Enqueue an item if any trigger fires. Idempotent — caller is expected
 * to dedupe via the (tenantId, turnId) unique constraint on the store.
 */
export async function enqueueActiveLearningItem(
  ports: ActiveLearningPorts,
  input: EnqueueInput,
): Promise<EnqueueOutcome> {
  const trigger = checkActiveLearningTrigger(input.signals);
  if (trigger === null) {
    return Object.freeze({ enqueued: false, trigger: null });
  }
  const now = ports.clock();
  const item: ActiveLearningItem = Object.freeze({
    tenantId: input.tenantId,
    turnId: input.turnId,
    status: 'pending' as ActiveLearningStatus,
    verbalisedConfidence: input.signals.verbalisedConfidence,
    prmStepScore: input.signals.prmStepScore,
    reason: trigger,
    queuedAt: now.toISOString(),
    declineCount: 0,
  });
  await ports.store.insert(item);
  return Object.freeze({ enqueued: true, trigger });
}

/**
 * Build a daily digest for a given labeller — applies anti-fatigue
 * cap and pulls from store's pending list.
 *
 * Anti-fatigue:
 *   1. Cap at MAX_ITEMS_PER_LABELLER_PER_DAY (default 25).
 *   2. Items at or above DECLINE_DEPRIORITISE_THRESHOLD declines are
 *      sorted last (lowest priority).
 */
export async function buildDailyDigest(
  ports: ActiveLearningPorts,
  args: {
    tenantId: string;
    labellerId: string;
  },
): Promise<ReadonlyArray<ActiveLearningItem>> {
  const today = ports.clock();
  const assignedToday = await ports.store.countAssignedToday({
    tenantId: args.tenantId,
    labellerId: args.labellerId,
    today,
  });
  const remaining = MAX_ITEMS_PER_LABELLER_PER_DAY - assignedToday;
  if (remaining <= 0) return Object.freeze([]);

  const pending = await ports.store.listPending({
    tenantId: args.tenantId,
    limit: remaining * 2, // pull double for sorting + filtering room
  });
  // Sort by (declineCount asc, queuedAt asc).
  const sorted = [...pending].sort((a, b) => {
    if (a.declineCount !== b.declineCount) {
      return a.declineCount - b.declineCount;
    }
    return a.queuedAt.localeCompare(b.queuedAt);
  });
  return Object.freeze(sorted.slice(0, remaining));
}

export interface RecordDeclineInput {
  readonly tenantId: string;
  readonly turnId: TurnId;
}

export interface RecordDeclineOutcome {
  readonly newDeclineCount: number;
  readonly deprioritised: boolean;
}

/**
 * Record a decline. Returns the new decline count + whether the item is
 * now deprioritised.
 */
export async function recordDecline(
  ports: ActiveLearningPorts,
  input: RecordDeclineInput,
): Promise<RecordDeclineOutcome> {
  const updated = await ports.store.incrementDeclineCount({
    tenantId: input.tenantId,
    turnId: input.turnId,
  });
  if (updated === null) {
    return Object.freeze({ newDeclineCount: 0, deprioritised: false });
  }
  const newDeclineCount = updated.declineCount;
  const deprioritised = newDeclineCount >= DECLINE_DEPRIORITISE_THRESHOLD;
  return Object.freeze({ newDeclineCount, deprioritised });
}
