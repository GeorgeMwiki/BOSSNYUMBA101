/**
 * captureReaction — record one owner feedback signal.
 *
 * Supports 9 reaction kinds (§2 R-LEARNING playbook + UX research):
 *   - thumbs_up         → KTO positive scalar
 *   - thumbs_down       → KTO negative scalar
 *   - star_rating       → KTO scalar (continuous label, stars/5)
 *   - regenerated       → DPO chosen=new, rejected=old (if subsequently
 *                         accepted by another reaction)
 *   - accepted_as_is    → mild positive signal; pairs with prior regenerate
 *   - edited_by_owner   → DPO chosen=edited, rejected=original
 *   - paused_skill      → skill-curation signal (M-F HITL feed)
 *   - resumed_skill     → skill-curation signal (re-enable)
 *   - manual_override   → strong negative signal + audit trail
 *
 * Persistence is delegated to a port (FeedbackEventStore) implementing
 * the J1 `feedback_event` entity.
 */

import type {
  FeedbackEvent,
  FeedbackPayload,
  ReactionKind,
  TurnId,
} from '../types.js';
import { validateFeedbackPayload } from './reaction-kinds.js';

/**
 * Input to captureReaction.
 */
export interface CaptureReactionInput {
  readonly tenantId: string;
  readonly turnId: TurnId;
  readonly kind: ReactionKind;
  readonly payload: FeedbackPayload;
}

/**
 * Storage port — wire-side persistence to the J1 `feedback_event`
 * entity. Multiple reactions per turn are allowed (e.g. star_rating
 * AND edited_by_owner). Implementations should index by turnId for
 * preference-pair-builder reads.
 */
export interface FeedbackEventStore {
  insert(event: FeedbackEvent): Promise<void>;
  listForTurn(args: {
    tenantId: string;
    turnId: TurnId;
  }): Promise<ReadonlyArray<FeedbackEvent>>;
}

/**
 * Owner-reaction-capture ports.
 */
export interface OwnerReactionPorts {
  readonly store: FeedbackEventStore;
  readonly clock: () => Date;
}

/**
 * Result of capturing a reaction.
 */
export interface CaptureReactionOutcome {
  readonly captured: boolean;
  readonly event: FeedbackEvent;
}

/**
 * Public entrypoint.
 */
export async function captureReaction(
  ports: OwnerReactionPorts,
  input: CaptureReactionInput,
): Promise<CaptureReactionOutcome> {
  // Validate the payload matches the declared kind (defensive — kernel
  // adapter should also validate at the boundary).
  validateFeedbackPayload(input.kind, input.payload);

  const now = ports.clock();
  const event: FeedbackEvent = Object.freeze({
    tenantId: input.tenantId,
    turnId: input.turnId,
    kind: input.kind,
    payload: input.payload,
    capturedAt: now.toISOString(),
  });

  await ports.store.insert(event);
  return Object.freeze({ captured: true, event });
}
