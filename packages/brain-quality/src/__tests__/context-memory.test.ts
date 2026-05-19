import { describe, expect, it } from 'vitest';

import {
  appendMessage,
  createContextMemory,
  estimateTokens,
  isWithinBudget,
} from '../memory/context-memory.js';
import type { ContextMessage } from '../types.js';

function msg(content: string, role: ContextMessage['role'] = 'user'): ContextMessage {
  return {
    role,
    content,
    tokens: estimateTokens(content),
    at: '2026-05-19T10:00:00Z',
  };
}

describe('ContextMemory — turn-scoped tier 1', () => {
  it('createContextMemory returns an empty, frozen snapshot', () => {
    const ctx = createContextMemory();
    expect(ctx.messages).toHaveLength(0);
    expect(ctx.tokens).toBe(0);
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('appendMessage adds a message immutably', () => {
    const ctx = createContextMemory();
    const next = appendMessage(ctx, msg('hello'));
    expect(ctx.messages).toHaveLength(0); // original unchanged
    expect(next.messages).toHaveLength(1);
    expect(next.tokens).toBeGreaterThan(0);
  });

  it('respects maxTokens budget by evicting non-pinned messages', () => {
    const ctx = createContextMemory({ maxTokens: 100, pinnedHead: 1 });
    const big = 'x'.repeat(800); // ~200 tokens at 4 chars/token
    const withPinned = appendMessage(ctx, msg('system frame', 'system'));
    const after1 = appendMessage(withPinned, msg(big));
    const after2 = appendMessage(after1, msg(big));
    expect(after2.tokens).toBeLessThanOrEqual(100 + 200); // budget plus most-recent
    // System frame must remain pinned at position 0.
    expect(after2.messages[0]?.role).toBe('system');
  });

  it('isWithinBudget reflects current state', () => {
    const ctx = createContextMemory({ maxTokens: 50, pinnedHead: 0 });
    const next = appendMessage(ctx, msg('a'));
    expect(isWithinBudget(next)).toBe(true);
  });

  it('rejects malformed messages via zod', () => {
    const ctx = createContextMemory();
    expect(() => appendMessage(ctx, { ...msg('ok'), tokens: -1 } as ContextMessage)).toThrow();
  });

  it('estimateTokens returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimateTokens is monotonic with length', () => {
    expect(estimateTokens('xxxx')).toBeLessThan(estimateTokens('xxxxxxxx'));
  });

  it('preserves pinnedHead even under extreme pressure', () => {
    const ctx = createContextMemory({ maxTokens: 10, pinnedHead: 2 });
    let s = appendMessage(ctx, msg('system frame', 'system'));
    s = appendMessage(s, msg('persona block', 'system'));
    for (let i = 0; i < 5; i += 1) {
      s = appendMessage(s, msg('y'.repeat(40)));
    }
    expect(s.messages.length).toBeGreaterThanOrEqual(2);
    expect(s.messages[0]?.content).toBe('system frame');
    expect(s.messages[1]?.content).toBe('persona block');
  });
});
