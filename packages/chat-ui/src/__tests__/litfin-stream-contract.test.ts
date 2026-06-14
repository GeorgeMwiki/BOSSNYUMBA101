/**
 * Live detector for the marketing-chat SSE contract between the
 * api-gateway producer (`public-marketing.hono.ts` → `marketingChatStream`)
 * and the widget consumer (`LitFinChatPanel.readEventStream`).
 *
 * The producer emits `StreamTurnEvent` frames:
 *   event: turn_start  data: {"type":"turn_start", ...}
 *   event: delta       data: {"type":"delta","content":"<token>"}
 *   event: handoff     data: {"type":"handoff", ...}
 *   event: turn_end    data: {"type":"turn_end", ...}
 *
 * If the consumer drifts back to the old `message_chunk` / `text`
 * contract, NO token frame matches and the bubble renders EMPTY — this
 * test fails loudly. It guards H40 from regressing.
 */

import { describe, expect, it, vi } from 'vitest';
import { readEventStream } from '../widget/LitFinChatPanel';

/** Build a one-shot ReadableStream from a list of UTF-8 string chunks. */
function streamFrom(chunks: ReadonlyArray<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
}

/** Serialize a StreamTurnEvent the way the gateway's streamSSE does. */
function sseFrame(eventName: string, payload: Record<string, unknown>): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

describe('readEventStream — gateway StreamTurnEvent contract', () => {
  it('renders non-empty assistant text from a delta token sequence', async () => {
    const tokens = ['Hello, ', 'I am ', 'Mr. Mwikila.'];
    const frames = [
      sseFrame('turn_start', {
        type: 'turn_start',
        threadId: 'bn-sess-1',
        personaId: 'public-guide',
        createdAt: '2026-06-14T00:00:00.000Z',
      }),
      ...tokens.map((t) => sseFrame('delta', { type: 'delta', content: t })),
      sseFrame('handoff', {
        type: 'handoff',
        from: 'public-guide',
        to: 'owner-portal',
        objective: 'suggested next step',
      }),
      sseFrame('turn_end', {
        type: 'turn_end',
        threadId: 'bn-sess-1',
        finalPersonaId: 'public-guide',
        totalTokens: 0,
        totalCost: 0,
        timeMs: 5,
        advisorConsulted: false,
      }),
    ];

    const onChunk = vi.fn();
    await readEventStream(streamFrom(frames), onChunk);

    const rendered = onChunk.mock.calls.map((c) => c[0]).join('');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toBe('Hello, I am Mr. Mwikila.');
    // turn_start / handoff / turn_end carry no running text — only the
    // three delta tokens should have reached the bubble.
    expect(onChunk).toHaveBeenCalledTimes(3);
  });

  it('reassembles tokens split across transport chunk boundaries', async () => {
    // The `data:` line for one delta arrives in two TCP reads.
    const transport = [
      'event: delta\n',
      'data: {"type":"delta","content":"split ',
      'token"}\n\n',
      sseFrame('turn_end', {
        type: 'turn_end',
        threadId: 't',
        finalPersonaId: 'p',
        totalTokens: 0,
        totalCost: 0,
        timeMs: 1,
        advisorConsulted: false,
      }),
    ];
    const onChunk = vi.fn();
    await readEventStream(streamFrom(transport), onChunk);
    expect(onChunk.mock.calls.map((c) => c[0]).join('')).toBe('split token');
  });

  it('terminates cleanly on turn_end before the transport closes', async () => {
    // A trailing delta AFTER turn_end must NOT be rendered — the stream
    // is already done. Proves the terminal-event short-circuit fires.
    const frames = [
      sseFrame('delta', { type: 'delta', content: 'kept' }),
      sseFrame('turn_end', {
        type: 'turn_end',
        threadId: 't',
        finalPersonaId: 'p',
        totalTokens: 0,
        totalCost: 0,
        timeMs: 1,
        advisorConsulted: false,
      }),
      sseFrame('delta', { type: 'delta', content: 'DROPPED' }),
    ];
    const onChunk = vi.fn();
    await readEventStream(streamFrom(frames), onChunk);
    const rendered = onChunk.mock.calls.map((c) => c[0]).join('');
    expect(rendered).toBe('kept');
    expect(rendered).not.toContain('DROPPED');
  });

  it('returns on an error event so the bubble stops streaming', async () => {
    const frames = [
      sseFrame('delta', { type: 'delta', content: 'partial' }),
      sseFrame('error', {
        type: 'error',
        code: 'AI_UNAVAILABLE',
        message: 'upstream failed',
        retryable: true,
      }),
      sseFrame('delta', { type: 'delta', content: 'AFTER_ERROR' }),
    ];
    const onChunk = vi.fn();
    await readEventStream(streamFrom(frames), onChunk);
    const rendered = onChunk.mock.calls.map((c) => c[0]).join('');
    expect(rendered).toBe('partial');
    expect(rendered).not.toContain('AFTER_ERROR');
  });

  it('still honours the legacy message_chunk / text public-chat shape', async () => {
    // Backward tolerance: the older Borjie/CLI producer emits
    // `message_chunk` with a `text` field. Both must keep rendering.
    const frames = [
      'event: message_chunk\ndata: {"text":"legacy "}\n\n',
      'event: message_chunk\ndata: {"delta":"shape"}\n\n',
      'event: done\ndata: {}\n\n',
    ];
    const onChunk = vi.fn();
    await readEventStream(streamFrom(frames), onChunk);
    expect(onChunk.mock.calls.map((c) => c[0]).join('')).toBe('legacy shape');
  });

  it('tolerates eventless Anthropic-style data frames and [DONE]', async () => {
    const frames = [
      'data: {"text":"anthropic style"}\n\n',
      'data: [DONE]\n\n',
      'data: {"text":"AFTER_DONE"}\n\n',
    ];
    const onChunk = vi.fn();
    await readEventStream(streamFrom(frames), onChunk);
    const rendered = onChunk.mock.calls.map((c) => c[0]).join('');
    expect(rendered).toBe('anthropic style');
    expect(rendered).not.toContain('AFTER_DONE');
  });
});
