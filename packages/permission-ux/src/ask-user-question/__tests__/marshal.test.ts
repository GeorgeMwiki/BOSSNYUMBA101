/**
 * marshalAnswer — typed-answer marshalling + free-text fallback +
 * cross-validation against the original question set.
 */

import { describe, it, expect } from 'vitest';
import { marshalAnswer } from '../marshal.js';
import type { AskUserQuestionInput, AnswerEnvelope } from '../schema.js';

const QUESTIONS: AskUserQuestionInput = {
  questions: [
    {
      id: 'q1',
      question: 'Send the notice now?',
      options: [
        { id: 'yes', label: 'Send now' },
        { id: 'no', label: 'Skip' },
      ],
    },
    {
      id: 'q2',
      question: 'Which channels?',
      multiSelect: true,
      allowFreeText: true,
      options: [
        { id: 'sms', label: 'SMS' },
        { id: 'wa', label: 'WhatsApp' },
        { id: 'email', label: 'Email' },
      ],
    },
  ],
};

describe('marshalAnswer — happy paths', () => {
  it('marshals a single-select answer', () => {
    const ans: AnswerEnvelope = {
      answers: [{ questionId: 'q1', selectedOptionIds: ['yes'] }],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain('[q1]');
      expect(r.text).toContain('Send now');
    }
  });

  it('marshals a multi-select answer', () => {
    const ans: AnswerEnvelope = {
      answers: [
        { questionId: 'q2', selectedOptionIds: ['sms', 'wa'] },
      ],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain('SMS');
      expect(r.text).toContain('WhatsApp');
    }
  });

  it('marshals a free-text fallback', () => {
    const ans: AnswerEnvelope = {
      answers: [
        {
          questionId: 'q2',
          selectedOptionIds: [],
          freeText: 'call me on Signal',
        },
      ],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain('free-text');
      expect(r.text).toContain('call me on Signal');
    }
  });

  it('joins multiple questions with newlines', () => {
    const ans: AnswerEnvelope = {
      answers: [
        { questionId: 'q1', selectedOptionIds: ['yes'] },
        { questionId: 'q2', selectedOptionIds: ['sms'] },
      ],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const lines = r.text.split('\n');
      expect(lines.length).toBe(2);
    }
  });
});

describe('marshalAnswer — failure modes', () => {
  it('rejects multi-select selections for a single-select question', () => {
    const ans: AnswerEnvelope = {
      answers: [{ questionId: 'q1', selectedOptionIds: ['yes', 'no'] }],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(false);
  });

  it('rejects unknown question id', () => {
    const ans: AnswerEnvelope = {
      answers: [{ questionId: 'q9', selectedOptionIds: ['yes'] }],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('unknown-question');
  });

  it('rejects unknown option id', () => {
    const ans: AnswerEnvelope = {
      answers: [{ questionId: 'q1', selectedOptionIds: ['maybe'] }],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('unknown-option');
  });

  it('rejects free-text on a question that did not allow it', () => {
    const ans: AnswerEnvelope = {
      answers: [
        {
          questionId: 'q1',
          selectedOptionIds: ['yes'],
          freeText: 'extra',
        },
      ],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(false);
  });

  it('rejects an answer with no selection and no free text', () => {
    const ans: AnswerEnvelope = {
      answers: [{ questionId: 'q1', selectedOptionIds: [] }],
    };
    const r = marshalAnswer(QUESTIONS, ans);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('missing-required');
  });

  it('rejects malformed question set (validation error)', () => {
    const r = marshalAnswer({ broken: true }, {
      answers: [{ questionId: 'q1', selectedOptionIds: ['yes'] }],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects malformed answer envelope (validation error)', () => {
    const r = marshalAnswer(QUESTIONS, { not: 'right' });
    expect(r.ok).toBe(false);
  });
});
