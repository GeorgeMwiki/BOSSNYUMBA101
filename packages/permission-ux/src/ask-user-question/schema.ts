/**
 * AskUserQuestion — typed schema for the tool call + the response
 * envelope.
 *
 * Mirrors the Claude Code primitive: the agent generates 1-4 questions
 * each with 2-4 options, optionally with preview blocks (HTML or
 * Markdown) and optionally allowing free-text fallback.
 *
 * The UI renders the questions; the owner's typed reply marshals back
 * into the tool-use loop via `marshalAnswer(...)`.
 */

import { z } from 'zod';

/** Preview format for the optional `preview` field on an option. */
export const PreviewFormatSchema = z.enum(['html', 'markdown']);

export const QuestionOptionSchema = z
  .object({
    /** Stable identifier — what `marshalAnswer` returns to the model. */
    id: z.string().min(1).max(120),
    /** Short label shown on the option button. */
    label: z.string().min(1).max(200),
    /** Longer plain-English description below the label. */
    description: z.string().max(2000).optional(),
    /**
     * Optional preview block — rendered inline below the option.
     * Format is either `html` or `markdown`; the renderer in
     * @bossnyumba/genui sanitises HTML at the boundary.
     */
    preview: z
      .object({
        format: PreviewFormatSchema,
        content: z.string().max(20_000),
      })
      .strict()
      .optional(),
  })
  .strict();

export const QuestionSchema = z
  .object({
    /** Stable identifier for the question. */
    id: z.string().min(1).max(120),
    /** The actual question text. */
    question: z.string().min(1).max(1000),
    /** 2-4 options. Claude Code allows 2-6; we cap at 8 for safety. */
    options: z.array(QuestionOptionSchema).min(2).max(8),
    /** Allow a typed free-text fallback alongside the options. */
    allowFreeText: z.boolean().optional(),
    /** Allow multiple selections from the option set. */
    multiSelect: z.boolean().optional(),
  })
  .strict();

export const AskUserQuestionInputSchema = z
  .object({
    /** Up to 4 simultaneous questions (Claude Code limit). */
    questions: z.array(QuestionSchema).min(1).max(4),
  })
  .strict();

export type AskUserQuestionInput = z.infer<typeof AskUserQuestionInputSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

// ─────────────────────────────────────────────────────────────────────
// Answer envelope (owner's reply -> back to the model)
// ─────────────────────────────────────────────────────────────────────

export const AnswerEntrySchema = z
  .object({
    /** Which question is being answered. */
    questionId: z.string().min(1).max(120),
    /** IDs of selected options (always an array; length 1 for single-select). */
    selectedOptionIds: z.array(z.string().min(1).max(120)).min(0).max(8),
    /** Optional free-text response if the question allowed it. */
    freeText: z.string().max(8000).optional(),
  })
  .strict();

export const AnswerEnvelopeSchema = z
  .object({
    /** Echoes the question set for joinable transcript reconstruction. */
    answers: z.array(AnswerEntrySchema).min(1).max(4),
  })
  .strict();

export type AnswerEntry = z.infer<typeof AnswerEntrySchema>;
export type AnswerEnvelope = z.infer<typeof AnswerEnvelopeSchema>;
