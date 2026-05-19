/**
 * Reaction-kind ↔ payload-shape validator.
 *
 * Each of the 9 reaction kinds carries a different payload shape. This
 * module provides a pure validator that throws on mismatch — wire-side
 * adapters are expected to call this at the boundary before any
 * persistence.
 */

import type { FeedbackPayload, ReactionKind } from '../types.js';

const VALID_STARS = new Set([1, 2, 3, 4, 5]);

/**
 * Throws if the payload does not match the kind. Returns nothing on
 * success — caller continues.
 */
export function validateFeedbackPayload(
  kind: ReactionKind,
  payload: FeedbackPayload,
): void {
  if (payload.kind !== kind) {
    throw new Error(
      `payload.kind '${payload.kind}' does not match reaction kind '${kind}'`,
    );
  }
  switch (payload.kind) {
    case 'thumbs_up':
    case 'thumbs_down':
    case 'accepted_as_is':
      return;
    case 'star_rating':
      if (!VALID_STARS.has(payload.stars)) {
        throw new Error(`star_rating stars must be 1-5, got ${payload.stars}`);
      }
      return;
    case 'regenerated':
      if (typeof payload.newContent !== 'string' || payload.newContent.length === 0) {
        throw new Error('regenerated payload.newContent must be a non-empty string');
      }
      return;
    case 'edited_by_owner':
      if (typeof payload.editedContent !== 'string' || payload.editedContent.length === 0) {
        throw new Error('edited_by_owner payload.editedContent must be non-empty');
      }
      return;
    case 'paused_skill':
    case 'resumed_skill':
      if (typeof payload.skillId !== 'string' || payload.skillId.length === 0) {
        throw new Error(`${payload.kind} payload.skillId must be a non-empty string`);
      }
      return;
    case 'manual_override':
      if (
        typeof payload.overrideReason !== 'string' ||
        payload.overrideReason.length === 0
      ) {
        throw new Error('manual_override payload.overrideReason must be non-empty');
      }
      return;
  }
}

/**
 * Which reaction kinds carry positive sentiment (for KTO scalar
 * generation). Note: star_rating is positive iff stars >= 4.
 */
export function isPositiveReaction(kind: ReactionKind): boolean {
  return (
    kind === 'thumbs_up' ||
    kind === 'accepted_as_is' ||
    kind === 'resumed_skill'
  );
}

/**
 * Which reaction kinds carry negative sentiment.
 */
export function isNegativeReaction(kind: ReactionKind): boolean {
  return (
    kind === 'thumbs_down' ||
    kind === 'paused_skill' ||
    kind === 'manual_override'
  );
}
