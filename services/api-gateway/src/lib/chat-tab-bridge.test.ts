/**
 * chat-tab-bridge tests — locks in the INCREMENTAL streaming-safe behaviour.
 *
 * The bridge must:
 *   1. Forward genuine live token deltas WITHOUT collapsing them into one
 *      delta (the brain now streams real tokens via `streamTurn`).
 *   2. Strip `<spawn_tabs>` / `<tab_*>` DSL — even when split across deltas —
 *      and re-emit the recognised tags as discrete SSE events.
 *   3. Never leak raw tab DSL into the visible text.
 *   4. Preserve event ordering relative to non-delta events.
 */

import { describe, it, expect } from 'vitest';
import { bridgeTabTags, type BridgedStreamEvent } from './chat-tab-bridge';
import type { StreamTurnEvent } from '@bossnyumba/ai-copilot';

async function* fromDeltas(
  parts: ReadonlyArray<StreamTurnEvent>,
): AsyncGenerator<StreamTurnEvent> {
  for (const p of parts) yield p;
}

async function collect(
  iter: AsyncGenerator<BridgedStreamEvent>,
): Promise<BridgedStreamEvent[]> {
  const out: BridgedStreamEvent[] = [];
  for await (const e of iter) out.push(e);
  return out;
}

function deltaText(events: BridgedStreamEvent[]): string {
  return events
    .filter((e): e is { type: 'delta'; content: string } => e.type === 'delta')
    .map((e) => e.content)
    .join('');
}

describe('bridgeTabTags', () => {
  it('forwards genuine live deltas without collapsing them', async () => {
    const parts: StreamTurnEvent[] = [
      { type: 'turn_start', threadId: 't1', personaId: 'owner-advisor', createdAt: 'now' },
      { type: 'delta', content: 'Hello ' },
      { type: 'delta', content: 'there, ' },
      { type: 'delta', content: 'owner.' },
      {
        type: 'turn_end',
        threadId: 't1',
        finalPersonaId: 'owner-advisor',
        totalTokens: 10,
        totalCost: 0,
        timeMs: 1,
        advisorConsulted: false,
      },
    ];
    const events = await collect(bridgeTabTags(fromDeltas(parts)));
    const deltas = events.filter((e) => e.type === 'delta');
    // Genuine streaming: each prose fragment surfaces as its own delta — the
    // bridge must NOT re-buffer the live stream into a single delta.
    expect(deltas.length).toBeGreaterThanOrEqual(3);
    expect(deltaText(events)).toBe('Hello there, owner.');
  });

  it('strips a self-closing tab tag split across deltas and emits an event', async () => {
    // The `<tab_spawn .../>` tag is fragmented across several deltas.
    const parts: StreamTurnEvent[] = [
      { type: 'turn_start', threadId: 't1', personaId: 'owner-advisor', createdAt: 'now' },
      { type: 'delta', content: 'Opening your portfolio ' },
      { type: 'delta', content: '<tab_spawn type="ins' },
      { type: 'delta', content: 'ights" title="Portfolio" />' },
      { type: 'delta', content: ' now.' },
      {
        type: 'turn_end',
        threadId: 't1',
        finalPersonaId: 'owner-advisor',
        totalTokens: 10,
        totalCost: 0,
        timeMs: 1,
        advisorConsulted: false,
      },
    ];
    const events = await collect(bridgeTabTags(fromDeltas(parts)));
    const text = deltaText(events);
    // No raw DSL leaks into the bubble.
    expect(text).not.toContain('<tab_spawn');
    expect(text).not.toContain('tab_spawn');
    expect(text).toContain('Opening your portfolio');
    expect(text).toContain('now.');
    // The recognised tag is re-emitted as its own event.
    const spawn = events.find((e) => e.type === 'tab_spawn');
    expect(spawn).toBeDefined();
  });

  it('streams prose live while a tag is still incomplete', async () => {
    // The leading prose must surface BEFORE the (eventual) tag — i.e. the
    // bridge does not hold the whole stream hostage waiting for a tag close.
    const parts: StreamTurnEvent[] = [
      { type: 'delta', content: 'First sentence. ' },
      { type: 'delta', content: 'Second sentence. ' },
      { type: 'delta', content: '<tab_spawn type="insights" title="P" />' },
    ];
    const events = await collect(bridgeTabTags(fromDeltas(parts)));
    const firstDelta = events.find((e) => e.type === 'delta');
    expect(firstDelta && 'content' in firstDelta && firstDelta.content).toContain(
      'First sentence.',
    );
    expect(deltaText(events)).toContain('Second sentence.');
    expect(deltaText(events)).not.toContain('<tab_spawn');
  });

  it('passes non-delta events through and preserves ordering', async () => {
    const parts: StreamTurnEvent[] = [
      { type: 'turn_start', threadId: 't1', personaId: 'p', createdAt: 'now' },
      { type: 'delta', content: 'Working on it. ' },
      { type: 'tool_call', name: 'lookup' },
      { type: 'tool_result', name: 'lookup', ok: true },
      { type: 'delta', content: 'Done.' },
      {
        type: 'turn_end',
        threadId: 't1',
        finalPersonaId: 'p',
        totalTokens: 1,
        totalCost: 0,
        timeMs: 1,
        advisorConsulted: false,
      },
    ];
    const events = await collect(bridgeTabTags(fromDeltas(parts)));
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('turn_start');
    expect(types.at(-1)).toBe('turn_end');
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    // Text before the tool_call must be emitted before it (ordering preserved).
    const toolIdx = types.indexOf('tool_call');
    const beforeTool = events
      .slice(0, toolIdx)
      .filter((e) => e.type === 'delta')
      .map((e) => (e as { content: string }).content)
      .join('');
    expect(beforeTool).toContain('Working on it.');
    expect(deltaText(events)).toBe('Working on it. Done.');
  });

  it('strips an orphan/partial tag at end of stream so nothing leaks', async () => {
    // A `<` that begins a recognised opener but never closes must be stripped
    // on the final flush, not leaked as visible text.
    const parts: StreamTurnEvent[] = [
      { type: 'delta', content: 'Trailing ' },
      { type: 'delta', content: '<tab_spawn type="insights"' },
    ];
    const events = await collect(bridgeTabTags(fromDeltas(parts)));
    const text = deltaText(events);
    expect(text).toContain('Trailing');
    expect(text).not.toContain('<tab_spawn');
  });

  it('leaves ordinary angle-bracket prose untouched', async () => {
    const parts: StreamTurnEvent[] = [
      { type: 'delta', content: 'Use a < b to compare and <not_a_tab> stays.' },
    ];
    const events = await collect(bridgeTabTags(fromDeltas(parts)));
    expect(deltaText(events)).toBe('Use a < b to compare and <not_a_tab> stays.');
  });
});
