/**
 * buildSafeModeMessage — assemble the `SafeModeEntryMessage` shown to
 * the owner when the confidence monitor trips.
 *
 * The Klarna lesson: pure-AI fails on edge cases. We give the owner
 * three explicit choices rather than burying the moment in prose.
 */

import type { SafeModeChoice, SafeModeEntryMessage } from './types.js';

export interface BuildSafeModeMessageInput {
  /** Reasons returned by `advanceSafeModeState`. */
  readonly reasons: ReadonlyArray<string>;
  /** Optional override for the headline. */
  readonly title?: string;
  /** Optional override for the explanation body. */
  readonly explanation?: string;
}

const DEFAULT_TITLE = "I'm not sure how to proceed";

const DEFAULT_EXPLANATION =
  "A few signals suggest I'm low-confidence about the next step. " +
  "Would you like to take this over, ask me to try a different approach, " +
  'or continue anyway?';

const BUTTONS: ReadonlyArray<{
  readonly id: SafeModeChoice;
  readonly label: string;
  readonly description: string;
}> = Object.freeze([
  Object.freeze({
    id: 'take-over',
    label: 'Take over',
    description:
      'Pause the agent. You drive from here; I will watch and provide context on request.',
  }),
  Object.freeze({
    id: 'try-different-approach',
    label: 'Try a different approach',
    description:
      'Resume in plan mode. I will propose a different plan and wait for your approval.',
  }),
  Object.freeze({
    id: 'continue-anyway',
    label: 'Continue anyway',
    description:
      'Override the safety stop and let me proceed. This decision is logged.',
  }),
]);

export function buildSafeModeMessage(
  input: BuildSafeModeMessageInput,
): SafeModeEntryMessage {
  return {
    title: input.title ?? DEFAULT_TITLE,
    explanation: input.explanation ?? DEFAULT_EXPLANATION,
    reasons: [...input.reasons],
    buttons: BUTTONS,
  };
}

/**
 * Resolve the owner's chosen button to the substrate's next-step
 * shape. The kernel uses this to branch its dispatch.
 *
 *   take-over               -> pause-agent (owner drives)
 *   try-different-approach  -> enter-plan-mode (regenerate plan)
 *   continue-anyway         -> resume + audit-log
 */
export type SafeModeNextStep =
  | { readonly kind: 'pause-agent' }
  | { readonly kind: 'enter-plan-mode' }
  | { readonly kind: 'resume-with-override' };

export function resolveSafeModeChoice(choice: SafeModeChoice): SafeModeNextStep {
  switch (choice) {
    case 'take-over':
      return { kind: 'pause-agent' };
    case 'try-different-approach':
      return { kind: 'enter-plan-mode' };
    case 'continue-anyway':
      return { kind: 'resume-with-override' };
  }
}
