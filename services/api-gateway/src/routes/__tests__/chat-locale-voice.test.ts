/**
 * Chat locale + voice-quality detectors (review mediums M).
 *
 * Live detectors for two gateway fixes that earlier waves wired-but-couldn't-back:
 *
 *  1. `streamWithConversationFeel` (ai-chat.hono.ts) — the anti-call-center
 *     guards (`stripChatbotFeel` / `stripTheatreFromUncertainty`, via
 *     `cleanChatResponse`) used to be NO-OPs on the user-visible SSE path:
 *     deltas streamed RAW and the guards ran only in the post-stream audit tap
 *     (computed-then-discarded). This wrapper buffers the prose deltas and
 *     emits the filler-STRIPPED body to the wire while preserving the
 *     `useChatStream` event-ordering contract and letting inline tab-control
 *     events pass through untouched.
 *
 *  2. `applyMarketingLocaleLock` (public-marketing.hono.ts) — the public
 *     marketing chat used to ignore the EN/SW UI toggle on the gateway path.
 *     The lock prepends a single-language directive so replies are strictly
 *     one language per the active locale (CLAUDE.md absolute toggle).
 *
 * Pure functions only — no LLM, no network, no DB.
 */

import { describe, it, expect } from 'vitest';
import { streamWithConversationFeel } from '../ai-chat.hono';
import { applyMarketingLocaleLock } from '../public-marketing.hono';

type Evt = { type: string; [k: string]: unknown };

async function* gen(events: readonly Evt[]): AsyncGenerator<Evt> {
  for (const e of events) yield e;
}

async function collect(
  source: AsyncGenerator<Evt>,
): Promise<{ events: Evt[]; accumulated: string }> {
  let accumulated = '';
  const out: Evt[] = [];
  for await (const e of streamWithConversationFeel(source, (raw) => {
    accumulated = raw;
  })) {
    out.push(e);
  }
  return { events: out, accumulated };
}

const deltas = (events: readonly Evt[]): string =>
  events
    .filter((e) => e.type === 'delta')
    .map((e) => String(e.content ?? ''))
    .join('');

describe('streamWithConversationFeel — anti-call-center guards LAND on the SSE path', () => {
  it('strips a filler opener from the streamed body before turn_end', async () => {
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'estate-manager', createdAt: 'now' },
        { type: 'delta', content: 'Of course! ' },
        { type: 'delta', content: 'Your arrears age 45 days.' },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'estate-manager', totalTokens: 10 },
      ]),
    );
    const body = deltas(events);
    // The "Of course!" filler opener is gone; the substance survives.
    expect(body.toLowerCase()).not.toContain('of course');
    expect(body).toContain('Your arrears age 45 days.');
  });

  it('strips a filler closer ("Is there anything else…") from the streamed body', async () => {
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: 'Rent is due on the 1st. ' },
        { type: 'delta', content: 'Is there anything else I can help you with?' },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 5 },
      ]),
    );
    const body = deltas(events);
    expect(body.toLowerCase()).not.toContain('anything else');
    expect(body).toContain('Rent is due on the 1st.');
  });

  it('flushes the cleaned body BEFORE the turn_end terminator (ordering contract)', async () => {
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: 'Sure, the lease renews in March.' },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 3 },
      ]),
    );
    const lastDeltaIdx = events.map((e) => e.type).lastIndexOf('delta');
    const turnEndIdx = events.findIndex((e) => e.type === 'turn_end');
    expect(lastDeltaIdx).toBeGreaterThanOrEqual(0);
    expect(turnEndIdx).toBeGreaterThan(lastDeltaIdx);
  });

  it('reports the RAW accumulated prose to onAccumulated (for the post-stream audit)', async () => {
    const { accumulated } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: 'Of course! ' },
        { type: 'delta', content: 'The deposit is 2 months.' },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 4 },
      ]),
    );
    // RAW (un-stripped) text — the audit re-derives cleaning deterministically.
    expect(accumulated).toBe('Of course! The deposit is 2 months.');
  });

  it('passes inline tab-control events through WITHOUT dropping later deltas', async () => {
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: 'Opening the arrears tab. ' },
        { type: 'tab_spawn', payload: { tabId: 'arrears' }, at: 'now' },
        { type: 'delta', content: 'Three tenants are overdue.' },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 6 },
      ]),
    );
    // Tab event survives.
    expect(events.some((e) => e.type === 'tab_spawn')).toBe(true);
    // BOTH delta segments reach the body — the post-tab text is NOT lost.
    const body = deltas(events);
    expect(body).toContain('Opening the arrears tab.');
    expect(body).toContain('Three tenants are overdue.');
  });

  it('does not flush a body before a tab event (tab passes through first)', async () => {
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: 'Text A. ' },
        { type: 'tab_update', payload: { tabId: 'x' }, at: 'now' },
        { type: 'delta', content: 'Text B.' },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 2 },
      ]),
    );
    // Exactly ONE consolidated delta flush (body settles once at the end), and
    // it carries the full accumulated prose — proving the tab event did not
    // trigger a premature flush.
    const deltaEvents = events.filter((e) => e.type === 'delta');
    expect(deltaEvents).toHaveLength(1);
    expect(String(deltaEvents[0].content)).toContain('Text A.');
    expect(String(deltaEvents[0].content)).toContain('Text B.');
  });

  it('preserves an already-clean reply unchanged (fail-open, removal-only)', async () => {
    const clean = 'The unit is vacant. List it at TZS 800,000.';
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: clean },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 7 },
      ]),
    );
    expect(deltas(events)).toBe(clean);
  });

  it('flushes a trailing body when the stream ends without a terminator', async () => {
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: 'Absolutely! The keys are at reception.' },
      ]),
    );
    const body = deltas(events);
    expect(body.toLowerCase()).not.toContain('absolutely');
    expect(body).toContain('The keys are at reception.');
  });

  it('does not mix EN/SW: a Swahili reply is left intact (EN regexes do not match)', async () => {
    const sw = 'Kodi inalipwa tarehe 1. Amana ni miezi miwili.';
    const { events } = await collect(
      gen([
        { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
        { type: 'delta', content: sw },
        { type: 'turn_end', threadId: 't1', finalPersonaId: 'p', totalTokens: 9 },
      ]),
    );
    // No English filler injected; Swahili substance untouched.
    expect(deltas(events)).toBe(sw);
  });
});

describe('applyMarketingLocaleLock — single-language per the EN/SW toggle', () => {
  const base = 'You are Mr. Mwikila. Respond helpfully.';

  it('prepends an ENGLISH-ONLY lock for en', () => {
    const out = applyMarketingLocaleLock(base, 'en');
    expect(out).toContain('ENGLISH ONLY');
    expect(out).not.toContain('KISWAHILI PEKEE');
    // The lock OUTRANKS the persona — it precedes the base prompt.
    expect(out.indexOf('ENGLISH ONLY')).toBeLessThan(out.indexOf(base));
  });

  it('prepends a SWAHILI-ONLY lock for sw', () => {
    const out = applyMarketingLocaleLock(base, 'sw');
    expect(out).toContain('KISWAHILI PEKEE');
    expect(out).not.toContain('ENGLISH ONLY');
    expect(out.indexOf('KISWAHILI PEKEE')).toBeLessThan(out.indexOf(base));
  });

  it('always preserves the original system prompt verbatim (IP/persona intact)', () => {
    expect(applyMarketingLocaleLock(base, 'en')).toContain(base);
    expect(applyMarketingLocaleLock(base, 'sw')).toContain(base);
  });

  it('the EN and SW locks are mutually exclusive (absolute toggle, zero mixing)', () => {
    const en = applyMarketingLocaleLock(base, 'en');
    const sw = applyMarketingLocaleLock(base, 'sw');
    expect(en).not.toEqual(sw);
    // EN lock carries no Swahili directive header and vice-versa.
    expect(en).not.toContain('Jibu kwa KISWAHILI');
    expect(sw).not.toContain('Respond ONLY in English');
  });
});
