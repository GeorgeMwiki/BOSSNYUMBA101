/**
 * Phase J8 — Server-Sent Events transport.
 *
 * Why SSE (not WebSocket) for the first cut?
 * - HTTP semantics survive corporate proxies + mobile-carrier filters
 *   far better than WebSocket upgrades (especially on 2G/3G).
 * - The kernel already emits an SSE-framed AG-UI stream (see
 *   `admin-jarvis-stream.router.ts`), so we keep wire-parity.
 * - `Last-Event-Id` is built-in — resume after socket drop is trivial.
 *
 * We deliberately do NOT use the browser `EventSource` API. EventSource
 * forbids custom headers (so no `Authorization: Bearer`) and cannot send
 * POST bodies. Instead we use `fetch` + a streaming reader and parse the
 * `event:` / `data:` lines via `sse-parser.ts` (also how the OpenAI SDK
 * ships a "browser SSE" shim).
 *
 * WebSocket transport was intentionally deferred to a follow-up PR to
 * keep this change focused.
 */

import type {
  ChatStreamEvent,
  ChatTransport,
  TransportConnectOptions,
  TransportEventListener,
  TransportState,
  TransportStateListener,
} from '../types.js';
import { drainSseFrames, tryParseChatStreamEvent } from './sse-parser.js';

export interface SseChatStreamDeps {
  /** Endpoint that returns `text/event-stream`. */
  endpoint: string;
  /** Defaults to the global `fetch`. Injected in tests. */
  fetchImpl?: typeof fetch;
  /** Clock — injected in tests. */
  now?: () => number;
  /**
   * Optional pre-flight hook so callers can re-issue the request from a
   * background scheduler (e.g. Workbox) on reconnect. Defaults to a
   * passthrough.
   */
  beforeConnect?: (req: RequestInit) => RequestInit;
}

export class SseChatStream implements ChatTransport {
  private readonly deps: Required<Omit<SseChatStreamDeps, 'beforeConnect'>> & {
    beforeConnect: (req: RequestInit) => RequestInit;
  };

  private state: TransportState = { kind: 'idle' };
  private readonly eventListeners = new Set<TransportEventListener>();
  private readonly stateListeners = new Set<TransportStateListener>();
  private abortController: AbortController | null = null;
  private lastEventId: string | null = null;
  /** Carry over partial bytes between fetch reads. */
  private pendingBuffer = '';

  constructor(deps: SseChatStreamDeps) {
    this.deps = {
      endpoint: deps.endpoint,
      fetchImpl: deps.fetchImpl ?? globalThis.fetch.bind(globalThis),
      now: deps.now ?? (() => Date.now()),
      beforeConnect: deps.beforeConnect ?? ((req) => req),
    };
  }

  getState(): TransportState {
    return this.state;
  }

  onEvent(listener: TransportEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onState(listener: TransportStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async connect(opts: TransportConnectOptions): Promise<void> {
    if (this.state.kind === 'connecting' || this.state.kind === 'open') {
      // Idempotent: re-issuing connect on an open stream is a no-op.
      // Callers that want a clean restart should call `disconnect()`.
      return;
    }
    this.setState({ kind: 'connecting' });

    this.abortController = new AbortController();
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.authToken}`,
      'X-Tenant-Id': opts.tenantId,
    };
    // Last-Event-Id is the canonical SSE resume header. Some transports
    // also accept a query-string fallback — we send both.
    const resumeFrom = opts.resumeFrom ?? this.lastEventId;
    if (resumeFrom) headers['Last-Event-Id'] = resumeFrom;

    const url = new URL(this.deps.endpoint);
    if (resumeFrom) url.searchParams.set('resumeFrom', resumeFrom);

    const body = JSON.stringify({
      threadId: opts.threadId,
      message: opts.message ?? '',
      presence: opts.presence ?? null,
      batchHintMs: opts.batchHintMs ?? null,
    });

    const initBase: RequestInit = {
      method: 'POST',
      headers,
      body,
      signal: this.abortController.signal,
    };
    const init = this.deps.beforeConnect(initBase);

    let response: Response;
    try {
      response = await this.deps.fetchImpl(url.toString(), init);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'sse-fetch-failed';
      this.setState({ kind: 'error', error: message, at: this.deps.now() });
      return;
    }
    if (!response.ok || !response.body) {
      this.setState({ kind: 'error', error: `sse-http-${response.status}`, at: this.deps.now() });
      return;
    }
    this.setState({ kind: 'open', openedAt: this.deps.now() });

    // Spawn the reader loop. We deliberately don't `await` it — the
    // caller wants `connect()` to resolve as soon as headers are in.
    void this.pumpReader(response.body);
  }

  disconnect(reason: string = 'client-disconnect'): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.state.kind !== 'closed') {
      this.setState({ kind: 'closed', reason, at: this.deps.now() });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private — reader loop
  // ─────────────────────────────────────────────────────────────────

  private async pumpReader(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          this.flushPending();
          this.setState({ kind: 'closed', reason: 'eof', at: this.deps.now() });
          return;
        }
        if (!value) continue;
        this.pendingBuffer += decoder.decode(value, { stream: true });
        this.drainFrames();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'sse-read-failed';
      // AbortError from disconnect() — exit cleanly, no error state.
      if (message.includes('aborted') || message === 'The user aborted a request.') {
        return;
      }
      this.setState({ kind: 'error', error: message, at: this.deps.now() });
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Reader may already be released.
      }
    }
  }

  private drainFrames(): void {
    const { frames, rest } = drainSseFrames(this.pendingBuffer);
    this.pendingBuffer = rest;
    for (const frame of frames) {
      if (frame.id) this.lastEventId = frame.id;
      const event = tryParseChatStreamEvent(frame);
      if (event) this.dispatch(event);
    }
  }

  private flushPending(): void {
    if (!this.pendingBuffer.trim()) return;
    const tail = this.pendingBuffer;
    this.pendingBuffer = '';
    const { frames } = drainSseFrames(`${tail}\n\n`);
    for (const frame of frames) {
      if (frame.id) this.lastEventId = frame.id;
      const event = tryParseChatStreamEvent(frame);
      if (event) this.dispatch(event);
    }
  }

  private dispatch(event: ChatStreamEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Listener errors must not poison the stream — they're swallowed
        // here; tests that care assert on the dispatch count.
      }
    }
  }

  private setState(next: TransportState): void {
    this.state = next;
    for (const listener of this.stateListeners) {
      try {
        listener(next);
      } catch {
        // Same isolation rule as `dispatch`.
      }
    }
  }
}
