/**
 * Phase J8 — SseChatStream tests.
 *
 * Strategy:
 * - We never reach the network. Instead we hand the transport a fake
 *   `fetch` that returns a `Response` whose body is a ReadableStream we
 *   control directly via a controller queue.
 * - For frame parsing we exercise the pure `parseSseFrame` +
 *   `tryParseChatStreamEvent` helpers without involving the transport.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SseChatStream } from './sse-chat-stream.js';
import { parseSseFrame, tryParseChatStreamEvent } from './sse-parser.js';
import type { ChatStreamEvent, TransportState } from '../types.js';

function frame(event: string, data: unknown, id?: string): string {
  const idLine = id ? `id: ${id}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Build a fake Response whose body is a ReadableStream we can write
 * SSE frames into via the returned controller. The controller is
 * yielded so tests can stream multi-chunk + boundary scenarios.
 */
function makeResponseStream(): { response: Response; push: (chunk: string) => void; close: () => void } {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const response = new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  return {
    response,
    push: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
    close: () => controller.close(),
  };
}

describe('parseSseFrame', () => {
  it('parses a single-line data frame', () => {
    const parsed = parseSseFrame('event: RUN_STARTED\ndata: {"type":"RUN_STARTED"}');
    expect(parsed.event).toBe('RUN_STARTED');
    expect(parsed.data).toBe('{"type":"RUN_STARTED"}');
  });

  it('joins multiple data lines with \\n', () => {
    const parsed = parseSseFrame('event: x\ndata: a\ndata: b\ndata: c');
    expect(parsed.data).toBe('a\nb\nc');
  });

  it('ignores comments and blank lines', () => {
    const parsed = parseSseFrame(': heartbeat\nevent: HB\n\ndata: ok');
    expect(parsed.event).toBe('HB');
    expect(parsed.data).toBe('ok');
  });

  it('strips the single optional space after the colon', () => {
    expect(parseSseFrame('data: hello').data).toBe('hello');
    expect(parseSseFrame('data:hello').data).toBe('hello');
  });

  it('extracts the id field', () => {
    expect(parseSseFrame('id: abc\ndata: 1').id).toBe('abc');
  });
});

describe('tryParseChatStreamEvent', () => {
  it('returns null on malformed JSON', () => {
    expect(tryParseChatStreamEvent({ event: 'x', id: null, data: '{not-json' })).toBeNull();
  });

  it('returns null when type is missing', () => {
    expect(tryParseChatStreamEvent({ event: 'x', id: null, data: '{"foo":1}' })).toBeNull();
  });

  it('accepts a valid event payload', () => {
    const parsed = tryParseChatStreamEvent({
      event: 'RUN_STARTED',
      id: null,
      data: '{"type":"RUN_STARTED","threadId":"t","runId":"r","timestamp":1}',
    });
    expect(parsed?.type).toBe('RUN_STARTED');
  });

  it('returns null on empty data', () => {
    expect(tryParseChatStreamEvent({ event: 'x', id: null, data: '' })).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(tryParseChatStreamEvent({ event: 'x', id: null, data: '42' })).toBeNull();
  });
});

describe('SseChatStream', () => {
  let stream: ReturnType<typeof makeResponseStream>;
  let fetchImpl: ReturnType<typeof vi.fn>;
  let transport: SseChatStream;
  let received: ChatStreamEvent[];
  let states: TransportState[];

  beforeEach(() => {
    stream = makeResponseStream();
    fetchImpl = vi.fn().mockResolvedValue(stream.response);
    transport = new SseChatStream({
      endpoint: 'https://test.example/chat-stream',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => 1_700_000_000_000,
    });
    received = [];
    states = [];
    transport.onEvent((e) => received.push(e));
    transport.onState((s) => states.push(s));
  });

  it('starts in idle state', () => {
    expect(transport.getState()).toEqual({ kind: 'idle' });
  });

  it('issues a POST with auth + tenant headers on connect', async () => {
    await transport.connect({
      tenantId: 'tenant-1',
      authToken: 'jwt.token',
      threadId: 'thread-A',
      message: 'hello',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt.token');
    expect(init.headers['X-Tenant-Id']).toBe('tenant-1');
    expect(init.headers.Accept).toBe('text/event-stream');
    expect(JSON.parse(init.body as string)).toMatchObject({ threadId: 'thread-A', message: 'hello' });
  });

  it('transitions to open then dispatches a single frame', async () => {
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    stream.push(frame('RUN_STARTED', { type: 'RUN_STARTED', threadId: 'th', runId: 'r1', timestamp: 1 }));
    // Yield to the reader microtask.
    await new Promise((r) => setTimeout(r, 0));
    expect(received.map((e) => e.type)).toEqual(['RUN_STARTED']);
    expect(states.some((s) => s.kind === 'connecting')).toBe(true);
    expect(states.some((s) => s.kind === 'open')).toBe(true);
  });

  it('handles a frame split across two read() chunks', async () => {
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    const full = frame('TEXT_MESSAGE_CONTENT', { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hi' });
    stream.push(full.slice(0, 20));
    stream.push(full.slice(20));
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ type: 'TEXT_MESSAGE_CONTENT', delta: 'hi' });
  });

  it('drops malformed JSON frames but keeps the stream open', async () => {
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    stream.push('event: x\ndata: {not-json\n\n');
    stream.push(frame('RUN_FINISHED', { type: 'RUN_FINISHED', runId: 'r', reason: 'completed' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('RUN_FINISHED');
  });

  it('records lastEventId for resume', async () => {
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    stream.push(frame('RUN_STARTED', { type: 'RUN_STARTED', threadId: 'th', runId: 'r1', timestamp: 1 }, 'evt-1'));
    await new Promise((r) => setTimeout(r, 0));
    // Disconnect then re-connect; the second connect should attach Last-Event-Id.
    // The mock must return a FRESH stream for the second connect — re-using the
    // first body would deadlock because it's already locked by the first reader.
    transport.disconnect('test');
    const second = makeResponseStream();
    fetchImpl.mockResolvedValueOnce(second.response);
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    const [, init] = fetchImpl.mock.calls[1]!;
    expect(init.headers['Last-Event-Id']).toBe('evt-1');
    second.close();
  });

  it('reports error state when fetch rejects', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('network-down'));
    const t = new SseChatStream({
      endpoint: 'https://test.example/x',
      fetchImpl: failing as unknown as typeof fetch,
    });
    const stateLog: TransportState[] = [];
    t.onState((s) => stateLog.push(s));
    await t.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    const errState = stateLog.find((s) => s.kind === 'error') as { kind: 'error'; error: string } | undefined;
    expect(errState).toBeTruthy();
    expect(errState?.error).toBe('network-down');
  });

  it('reports error state on non-2xx response', async () => {
    const failing = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
    const t = new SseChatStream({
      endpoint: 'https://test.example/x',
      fetchImpl: failing as unknown as typeof fetch,
    });
    const stateLog: TransportState[] = [];
    t.onState((s) => stateLog.push(s));
    await t.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    const errState = stateLog.find((s) => s.kind === 'error') as { kind: 'error'; error: string } | undefined;
    expect(errState?.error).toContain('500');
  });

  it('is idempotent — second connect on open stream is a no-op', async () => {
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('disconnect transitions to closed', async () => {
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    transport.disconnect('user-quit');
    const closed = states.find((s) => s.kind === 'closed') as { kind: 'closed'; reason: string } | undefined;
    expect(closed?.reason).toBe('user-quit');
  });

  it('isolates a throwing listener — other listeners still receive', async () => {
    const good: ChatStreamEvent[] = [];
    transport.onEvent(() => {
      throw new Error('boom');
    });
    transport.onEvent((e) => good.push(e));
    await transport.connect({ tenantId: 't', authToken: 'a', threadId: 'th', message: 'm' });
    stream.push(frame('RUN_STARTED', { type: 'RUN_STARTED', threadId: 't', runId: 'r', timestamp: 1 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(good).toHaveLength(1);
  });
});
