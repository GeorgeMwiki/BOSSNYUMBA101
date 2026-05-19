import { describe, expect, it } from 'vitest';
import { decideFromMode } from '../hooks/permission-mode.js';

describe('decideFromMode', () => {
  it('dry-run forbids side effects and yields dry-run status', () => {
    const d = decideFromMode('dry-run');
    expect(d.allowSideEffect).toBe(false);
    expect(d.ledgerStatus).toBe('dry-run');
  });

  it('propose yields a draft entry, no side effect', () => {
    const d = decideFromMode('propose');
    expect(d.allowSideEffect).toBe(false);
    expect(d.ledgerStatus).toBe('draft');
  });

  it('act-on-yes awaits owner', () => {
    const d = decideFromMode('act-on-yes');
    expect(d.allowSideEffect).toBe(false);
    expect(d.ledgerStatus).toBe('awaiting-owner');
  });

  it('auto allows side effects', () => {
    const d = decideFromMode('auto');
    expect(d.allowSideEffect).toBe(true);
    expect(d.ledgerStatus).toBe('sealed');
  });

  it('each mode produces a non-empty reason string', () => {
    expect(decideFromMode('dry-run').reason.length).toBeGreaterThan(0);
    expect(decideFromMode('propose').reason.length).toBeGreaterThan(0);
    expect(decideFromMode('act-on-yes').reason.length).toBeGreaterThan(0);
    expect(decideFromMode('auto').reason.length).toBeGreaterThan(0);
  });
});
