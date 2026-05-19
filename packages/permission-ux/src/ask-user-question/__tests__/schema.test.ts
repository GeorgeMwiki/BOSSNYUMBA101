/**
 * AskUserQuestion schemas — accept canonical shapes; reject malformed.
 */

import { describe, it, expect } from 'vitest';
import {
  AskUserQuestionInputSchema,
  AnswerEnvelopeSchema,
} from '../schema.js';

describe('AskUserQuestionInputSchema', () => {
  it('accepts a minimal one-question single-select', () => {
    const r = AskUserQuestionInputSchema.safeParse({
      questions: [
        {
          id: 'q1',
          question: 'Send the late-rent notice now?',
          options: [
            { id: 'yes', label: 'Send now' },
            { id: 'no', label: 'Skip' },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a question with HTML preview', () => {
    const r = AskUserQuestionInputSchema.safeParse({
      questions: [
        {
          id: 'q1',
          question: 'Preview the notice?',
          options: [
            {
              id: 'send',
              label: 'Send',
              description: '5 KB notice',
              preview: {
                format: 'html',
                content: '<p>Dear Asha, ...</p>',
              },
            },
            { id: 'skip', label: 'Skip' },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a multi-select with free-text', () => {
    const r = AskUserQuestionInputSchema.safeParse({
      questions: [
        {
          id: 'q1',
          question: 'Which tenants to notify?',
          multiSelect: true,
          allowFreeText: true,
          options: [
            { id: 'a', label: 'Tenant A' },
            { id: 'b', label: 'Tenant B' },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects a question with fewer than 2 options', () => {
    const r = AskUserQuestionInputSchema.safeParse({
      questions: [
        {
          id: 'q1',
          question: 'Hello?',
          options: [{ id: 'a', label: 'A' }],
        },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('rejects more than 4 questions', () => {
    const make = (i: number) => ({
      id: `q${i}`,
      question: `q${i}?`,
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    });
    const r = AskUserQuestionInputSchema.safeParse({
      questions: [make(1), make(2), make(3), make(4), make(5)],
    });
    expect(r.success).toBe(false);
  });
});

describe('AnswerEnvelopeSchema', () => {
  it('accepts a single-select answer', () => {
    const r = AnswerEnvelopeSchema.safeParse({
      answers: [{ questionId: 'q1', selectedOptionIds: ['yes'] }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a free-text-only answer', () => {
    const r = AnswerEnvelopeSchema.safeParse({
      answers: [
        {
          questionId: 'q1',
          selectedOptionIds: [],
          freeText: 'I want to do something else',
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('rejects an empty answers array', () => {
    const r = AnswerEnvelopeSchema.safeParse({ answers: [] });
    expect(r.success).toBe(false);
  });
});
