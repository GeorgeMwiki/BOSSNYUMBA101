/**
 * API helpers for the /ask surface.
 *
 * Three responsibilities:
 *   1. Auth-aware base-URL + header resolution (localStorage token).
 *   2. Thread CRUD — list / get / create — over fetch with status-first
 *      return shape so callers map HTTP to degraded-states cleanly.
 *   3. SSE streaming — POST to /thread/:id/message, read the ReadableStream,
 *      decode bytes, parse SSE frames ("event: X\ndata: Y\n\n"), yield
 *      typed AgentEvent values. NO external lib.
 */

import type {
  AgentEvent,
  DegradedReason,
  StoredTurn,
  ThreadSummary,
} from './types';

/* ──────────────────────────── Base config ──────────────────────────── */

function getApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function getAuthHeader(): Readonly<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  // The app stores tokens under two keys depending on boot path —
  // prefer `auth_token` (ApiProvider) then fall back to `manager_token`
  // (graph explorer).
  const token =
    window.localStorage.getItem('auth_token') ||
    window.localStorage.getItem('manager_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─────────────────────────── Result shape ──────────────────────────── */

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly status: number;
      readonly reason: DegradedReason;
      readonly message: string;
    };

function degradedFromStatus(status: number): ApiResult<never> {
  if (status === 401) {
    return {
      ok: false,
      status,
      reason: 'unauthorized',
      message: 'Your session timed out. Sign in again so I can catch you up.',
    };
  }
  if (status === 403) {
    return {
      ok: false,
      status,
      reason: 'forbidden',
      message: "I can't show this to you — you need property-manager or higher.",
    };
  }
  if (status === 503) {
    return {
      ok: false,
      status,
      reason: 'unavailable',
      message: "I'm here but can't reach my memory right now. Give me a minute.",
    };
  }
  return {
    ok: false,
    status,
    reason: 'unknown',
    message: `I couldn't complete that (status ${status}). Try again.`,
  };
}

/* ──────────────────────── Thread endpoints ─────────────────────────── */

export async function listThreads(): Promise<ApiResult<ReadonlyArray<ThreadSummary>>> {
  const base = getApiBase();
  if (!base) {
    return {
      ok: false,
      status: 503,
      reason: 'unavailable',
      message:
        "I can't find my address book on this environment. Ask ops to set NEXT_PUBLIC_API_URL.",
    };
  }
  try {
    const res = await fetch(`${base}/api/v1/intelligence/threads`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    if (!res.ok) return degradedFromStatus(res.status);
    const body = (await res.json()) as { readonly threads: ReadonlyArray<ThreadSummary> };
    return { ok: true, data: body.threads ?? [] };
  } catch (error) {
    console.error('listThreads failed', error);
    return {
      ok: false,
      status: 0,
      reason: 'network',
      message: "I can't reach my memory right now. Check your connection.",
    };
  }
}

export async function getThread(
  threadId: string,
): Promise<
  ApiResult<{ readonly thread: ThreadSummary; readonly turns: ReadonlyArray<StoredTurn> }>
> {
  const base = getApiBase();
  if (!base) {
    return {
      ok: false,
      status: 503,
      reason: 'unavailable',
      message: "I can't find my address book on this environment.",
    };
  }
  try {
    const res = await fetch(
      `${base}/api/v1/intelligence/thread/${encodeURIComponent(threadId)}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      },
    );
    if (!res.ok) return degradedFromStatus(res.status);
    const body = (await res.json()) as {
      readonly thread: ThreadSummary;
      readonly turns: ReadonlyArray<StoredTurn>;
    };
    return { ok: true, data: body };
  } catch (error) {
    console.error('getThread failed', error);
    return {
      ok: false,
      status: 0,
      reason: 'network',
      message: "I can't reach my memory right now. Check your connection.",
    };
  }
}

export async function createThread(
  seedMessage: string,
): Promise<ApiResult<{ readonly threadId: string; readonly title: string }>> {
  const base = getApiBase();
  if (!base) {
    return {
      ok: false,
      status: 503,
      reason: 'unavailable',
      message: "I can't find my address book on this environment.",
    };
  }
  try {
    const res = await fetch(`${base}/api/v1/intelligence/thread`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ seedMessage }),
    });
    if (!res.ok) return degradedFromStatus(res.status);
    const body = (await res.json()) as {
      readonly threadId: string;
      readonly title: string;
    };
    return { ok: true, data: body };
  } catch (error) {
    console.error('createThread failed', error);
    return {
      ok: false,
      status: 0,
      reason: 'network',
      message: "I can't reach my memory right now. Check your connection.",
    };
  }
}

/* ────────────────────── SSE streaming transport ─────────────────────── */

export interface StreamMessageArgs {
  readonly threadId: string;
  readonly userMessage: string;
  readonly extendedThinking: boolean;
  readonly signal?: AbortSignal;
}

/**
 * streamMessage — open an SSE stream for one user turn. Yields typed
 * AgentEvent values. If the server rejects upfront (401/403/503) it
 * yields a synthetic 'error' event and returns.
 *
 * Implementation notes:
 *   - POST, so we cannot use EventSource. We use fetch + ReadableStream.
 *   - TextDecoder accumulates bytes across chunk boundaries.
 *   - A frame buffer holds partial SSE frames until "\n\n" terminator.
 *   - We ignore unknown event names; unknown data JSON fails safely.
 */
export async function* streamMessage(
  args: StreamMessageArgs,
): AsyncGenerator<AgentEvent, void, void> {
  const base = getApiBase();
  if (!base) {
    yield {
      kind: 'error',
      message:
        "I can't find my address book on this environment. Ask ops to set NEXT_PUBLIC_API_URL.",
      retryable: false,
      at: new Date().toISOString(),
    };
    return;
  }

  let res: Response;
  try {
    res = await fetch(
      `${base}/api/v1/intelligence/thread/${encodeURIComponent(args.threadId)}/message`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          userMessage: args.userMessage,
          extendedThinking: args.extendedThinking,
        }),
        signal: args.signal,
      },
    );
  } catch (error) {
    yield {
      kind: 'error',
      message:
        error instanceof Error && error.name === 'AbortError'
          ? 'I stopped when you asked me to.'
          : "I couldn't open the stream. Check your connection.",
      retryable: true,
      at: new Date().toISOString(),
    };
    return;
  }

  if (!res.ok) {
    const degraded = degradedFromStatus(res.status);
    yield {
      kind: 'error',
      message: degraded.ok ? 'Unknown error.' : degraded.message,
      retryable: res.status !== 401 && res.status !== 403,
      at: new Date().toISOString(),
    };
    return;
  }

  if (!res.body) {
    yield {
      kind: 'error',
      message: "I opened the stream but nothing came back.",
      retryable: true,
      at: new Date().toISOString(),
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process every complete SSE frame terminated by a blank line.
      // Frames may use \n or \r\n line endings; normalise the
      // terminator to \n\n before splitting.
      const normalised = buffer.replace(/\r\n/g, '\n');
      const frames = normalised.split('\n\n');
      // The last entry is either "" (if buffer ended on \n\n) or a
      // partial frame we keep for the next read.
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const parsed = parseSseFrame(frame);
        if (parsed) yield parsed;
      }
    }
    // Flush any trailing complete frame held in the buffer.
    if (buffer.length > 0) {
      const parsed = parseSseFrame(buffer.replace(/\r\n/g, '\n'));
      if (parsed) yield parsed;
    }
  } catch (error) {
    yield {
      kind: 'error',
      message:
        error instanceof Error && error.name === 'AbortError'
          ? 'I stopped when you asked me to.'
          : 'The stream dropped. Try sending again.',
      retryable: true,
      at: new Date().toISOString(),
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop — already released */
    }
  }
}

/**
 * parseSseFrame — turn one SSE frame into an AgentEvent.
 *
 * Accepts frames in either of these shapes:
 *   event: <kind>\ndata: <json>
 *   data: <json-with-kind-field>
 *
 * Returns null for empty / comment / malformed frames.
 */
function parseSseFrame(rawFrame: string): AgentEvent | null {
  const frame = rawFrame.trim();
  if (frame.length === 0) return null;
  // Comments (lines starting with ":") are heartbeats — ignore.
  if (frame.startsWith(':')) return null;

  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
    // Ignore id:, retry:, and other SSE fields we don't use.
  }

  if (dataLines.length === 0) return null;
  const dataText = dataLines.join('\n');

  let payload: unknown;
  try {
    payload = JSON.parse(dataText);
  } catch {
    // Not JSON — treat as a plain text delta if an event name says so.
    if (eventName === 'text') {
      return {
        kind: 'text',
        delta: dataText,
        at: new Date().toISOString(),
      };
    }
    return null;
  }

  if (payload === null || typeof payload !== 'object') return null;

  // If the payload carries its own discriminator, trust it; otherwise
  // derive from the SSE event: header.
  const asRecord = payload as Record<string, unknown>;
  if (typeof asRecord.kind === 'string') {
    return asRecord as unknown as AgentEvent;
  }
  if (eventName) {
    return { ...asRecord, kind: eventName } as unknown as AgentEvent;
  }
  return null;
}
