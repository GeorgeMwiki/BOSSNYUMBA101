/**
 * Ports unit tests.
 */

import { describe, expect, it } from 'vitest';
import { extractText, type LlmCompletionResponse } from '../llm-client.js';
import {
  InMemorySovereignLedger,
  type SovereignLedgerEntry,
} from '../sovereign-ledger.js';
import { fixedClock, tickingClock, systemClock } from '../clock.js';

describe('extractText', () => {
  it('joins text blocks', () => {
    const resp: LlmCompletionResponse = {
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'tool_use', text: undefined },
        { type: 'text', text: 'world' },
      ],
    };
    expect(extractText(resp)).toBe('Hello world');
  });

  it('returns empty string when no text', () => {
    expect(extractText({ content: [] })).toBe('');
  });
});

describe('InMemorySovereignLedger', () => {
  const entry = (id: string): SovereignLedgerEntry => ({
    id,
    timestamp: '2026-05-19T00:00:00Z',
    tenantId: 'T',
    actionClass: 'rent-reminder',
    module: 'cove',
    verdict: 'pass',
    summary: 's',
    detail: {},
  });

  it('appends and lists', async () => {
    const ledger = new InMemorySovereignLedger();
    await ledger.append(entry('a'));
    await ledger.append(entry('b'));
    expect(ledger.list()).toHaveLength(2);
  });

  it('clear empties the ledger', async () => {
    const ledger = new InMemorySovereignLedger();
    await ledger.append(entry('a'));
    ledger.clear();
    expect(ledger.list()).toHaveLength(0);
  });
});

describe('clocks', () => {
  it('fixedClock returns the start date', () => {
    const c = fixedClock(new Date('2026-05-19T00:00:00Z'));
    expect(c.now().toISOString()).toBe('2026-05-19T00:00:00.000Z');
    expect(c.monotonicMs()).toBe(0);
  });

  it('tickingClock advances by step on each call', () => {
    const c = tickingClock(0, 1000);
    const t1 = c.monotonicMs();
    const t2 = c.monotonicMs();
    expect(t2 - t1).toBe(1000);
  });

  it('systemClock exists', () => {
    expect(typeof systemClock.now().getTime()).toBe('number');
  });
});
