/**
 * marshalAnswer — converts the typed `AnswerEnvelope` (UI -> server)
 * into the string the kernel feeds back into the tool-use loop as the
 * `AskUserQuestion` tool result.
 *
 * Shape: one line per question, joined with newlines. Lines look like
 *
 *   Q1 [<question>]: <label-or-labels>[, free-text: "<text>"]
 *
 * Plain enough for the model to parse, structured enough that a
 * compliance log can read it back later.
 */

import {
  AnswerEnvelopeSchema,
  AskUserQuestionInputSchema,
  type AnswerEnvelope,
  type AnswerEntry,
  type AskUserQuestionInput,
  type Question,
} from './schema.js';

export interface MarshalError {
  readonly kind: 'validation-error' | 'unknown-question' | 'unknown-option' | 'missing-required';
  readonly message: string;
}

export type MarshalResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: MarshalError };

/**
 * Validate the owner's answer against the original question set and
 * format the result string. Pure.
 */
export function marshalAnswer(
  rawQuestions: AskUserQuestionInput | unknown,
  rawAnswers: AnswerEnvelope | unknown,
): MarshalResult {
  const qParse = AskUserQuestionInputSchema.safeParse(rawQuestions);
  if (!qParse.success) {
    return {
      ok: false,
      error: {
        kind: 'validation-error',
        message: `questions failed validation: ${qParse.error.message}`,
      },
    };
  }
  const aParse = AnswerEnvelopeSchema.safeParse(rawAnswers);
  if (!aParse.success) {
    return {
      ok: false,
      error: {
        kind: 'validation-error',
        message: `answers failed validation: ${aParse.error.message}`,
      },
    };
  }

  const questions = qParse.data.questions;
  const byId = new Map(questions.map((q) => [q.id, q]));

  const lines: string[] = [];
  for (const ans of aParse.data.answers) {
    const q = byId.get(ans.questionId);
    if (!q) {
      return {
        ok: false,
        error: {
          kind: 'unknown-question',
          message: `answer references unknown question id '${ans.questionId}'`,
        },
      };
    }

    const lineRes = renderAnswerLine(q, ans);
    if (!lineRes.ok) return lineRes;
    lines.push(lineRes.text);
  }

  return { ok: true, text: lines.join('\n') };
}

function renderAnswerLine(q: Question, ans: AnswerEntry): MarshalResult {
  const optionById = new Map(q.options.map((o) => [o.id, o]));
  const labels: string[] = [];

  if (!q.multiSelect && ans.selectedOptionIds.length > 1) {
    return {
      ok: false,
      error: {
        kind: 'validation-error',
        message: `question '${q.id}' is single-select but ${ans.selectedOptionIds.length} options were selected`,
      },
    };
  }

  for (const optId of ans.selectedOptionIds) {
    const opt = optionById.get(optId);
    if (!opt) {
      return {
        ok: false,
        error: {
          kind: 'unknown-option',
          message: `question '${q.id}' has no option with id '${optId}'`,
        },
      };
    }
    labels.push(opt.label);
  }

  const hasFreeText = typeof ans.freeText === 'string' && ans.freeText.length > 0;
  if (!hasFreeText && labels.length === 0) {
    // A reply with no selections AND no free text is invalid — every
    // question must surface SOMETHING back to the model.
    return {
      ok: false,
      error: {
        kind: 'missing-required',
        message: `question '${q.id}' has no selection and no free-text answer`,
      },
    };
  }

  if (hasFreeText && !q.allowFreeText) {
    return {
      ok: false,
      error: {
        kind: 'validation-error',
        message: `question '${q.id}' did not allow free-text but a free-text answer was supplied`,
      },
    };
  }

  const labelPart = labels.length > 0 ? labels.join(', ') : '(no option selected)';
  const ftPart = hasFreeText
    ? `, free-text: ${JSON.stringify(ans.freeText)}`
    : '';
  return {
    ok: true,
    text: `[${q.id}] ${q.question} -> ${labelPart}${ftPart}`,
  };
}
