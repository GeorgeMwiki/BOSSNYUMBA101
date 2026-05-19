/**
 * AskUserQuestion tool-spec — registry-friendly shape.
 */

import { describe, it, expect } from 'vitest';
import {
  ASK_USER_QUESTION_TOOL_NAME,
  ASK_USER_QUESTION_TIER,
  ASK_USER_QUESTION_TOOL_SPEC,
} from '../tool-spec.js';

describe('ASK_USER_QUESTION_TOOL_SPEC', () => {
  it('has the canonical name', () => {
    expect(ASK_USER_QUESTION_TOOL_NAME).toBe('AskUserQuestion');
    expect(ASK_USER_QUESTION_TOOL_SPEC.name).toBe('AskUserQuestion');
  });

  it('is registered as read-tier (asking a question doesn\'t mutate)', () => {
    expect(ASK_USER_QUESTION_TIER).toBe('read');
    expect(ASK_USER_QUESTION_TOOL_SPEC.tier).toBe('read');
  });

  it('input schema validates a typed question payload', () => {
    const r = ASK_USER_QUESTION_TOOL_SPEC.inputSchema.safeParse({
      questions: [
        {
          id: 'q1',
          question: 'pick one',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('output schema validates a typed answer payload', () => {
    const r = ASK_USER_QUESTION_TOOL_SPEC.outputSchema.safeParse({
      answers: [{ questionId: 'q1', selectedOptionIds: ['a'] }],
    });
    expect(r.success).toBe(true);
  });
});
