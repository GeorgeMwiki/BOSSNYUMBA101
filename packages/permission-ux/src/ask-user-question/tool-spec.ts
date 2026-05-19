/**
 * AskUserQuestion — tool spec the kernel registers when wiring this
 * substrate into the orchestrator.
 *
 * The tool definition is intentionally I/O-free: it carries the
 * canonical name + schema + risk-tier metadata. The handler is the
 * caller's responsibility (typically: emit an ag-ui question card,
 * await the owner's reply, return `marshalAnswer(...)`).
 */

import {
  AskUserQuestionInputSchema,
  AnswerEnvelopeSchema,
  type AskUserQuestionInput,
} from './schema.js';
import type { RiskTier } from '../types.js';

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion';

/** Tier for the tool itself — asking a question is read-only. */
export const ASK_USER_QUESTION_TIER: RiskTier = 'read';

/**
 * Declarative description used to render the tool in the registry
 * UI + the JSON schema offered to Claude.
 */
export const ASK_USER_QUESTION_TOOL_SPEC = Object.freeze({
  name: ASK_USER_QUESTION_TOOL_NAME,
  description:
    'Ask the owner one to four typed multiple-choice questions, each with 2-8 options. ' +
    'Options may include an HTML or Markdown preview block. Optionally allow free-text fallback ' +
    'or multi-select. Returns the owner\'s typed answer envelope.',
  tier: ASK_USER_QUESTION_TIER,
  inputSchema: AskUserQuestionInputSchema,
  outputSchema: AnswerEnvelopeSchema,
});

export type AskUserQuestionToolInput = AskUserQuestionInput;
