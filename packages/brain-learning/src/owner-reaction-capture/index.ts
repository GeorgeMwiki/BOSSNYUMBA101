/**
 * Module 2 — owner-reaction-capture
 *
 * Capture 9 owner-feedback signals → drives preference-pair generation.
 */

export {
  captureReaction,
  type CaptureReactionInput,
  type CaptureReactionOutcome,
  type FeedbackEventStore,
  type OwnerReactionPorts,
} from './capture-reaction.js';

export {
  validateFeedbackPayload,
  isPositiveReaction,
  isNegativeReaction,
} from './reaction-kinds.js';
