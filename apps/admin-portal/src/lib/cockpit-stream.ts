/**
 * Cockpit SSE consumer (owner-portal) — Roadmap R6.
 *
 * Opens an EventSource (technically `fetch()`+SSE parser because the
 * native EventSource cannot pass an Authorization header) to
 * GET /api/v1/cockpit/stream and dispatches each event-kind payload to
 * a per-kind handler. Tenant scope is enforced server-side by the JWT
 * — the client cannot ask for another tenant's stream.
 *
 * Identical bodies live in:
 *   - apps/customer-app/src/lib/cockpit-stream.ts (next slice)
 *   - apps/estate-manager-app/src/lib/cockpit-stream.ts (next slice)
 *
 * Auto-reconnect with exponential backoff (max 30s) so transient
 * gateway restarts don't drop the brain's push channel.
 */

import type { ReadableStreamDefaultReader } from 'stream/web';

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 500;

export type CockpitEventKind =
  | 'connected'
  | 'heartbeat'
  | 'decision.recorded'
  | 'reminder.fired'
  | 'opportunity.scan_completed'
  | 'risk.changed'
  | 'staff.shift_event'
  | 'compliance.deadline_approaching'
  | 'persona.acted'
  | 'persona.proposes'
  | 'rent.collected'
  | 'lease.signed'
  | 'lease.renewed'
  | 'lease.terminated'
  | 'maintenance.completed'
  | 'maintenance.requested'
  | 'inspection.completed'
  | 'inspection.scheduled'
  | 'application.submitted'
  | 'application.approved'
  | 'application.rejected'
  | 'viewing.scheduled'
  | 'viewing.completed'
  | 'regulator.request_received'
  | 'regulator.request_status_changed'
  | 'rfa.dispatched'
  | 'task.assigned'
  | 'safety.incident_reported'
  | 'rent_payout.initiated'
  | 'payroll.committed'
  | 'licence.renewed'
  | 'chat.handoff'
  | 'manager.approved'
  | 'bid.placed'
  | 'incident.escalated'
  | 'cockpit.tab.spawned'
  | 'cockpit.tab.updated'
  | 'cockpit.tab.removed'
  | 'cockpit.tab.proposed'
  | 'property.celebrate';

export interface CockpitStreamHandlers {
  readonly onEvent?: (kind: CockpitEventKind, data: unknown) => void;
  readonly onConnected?: () => void;
  readonly onClose?: () => void;
}

export interface CockpitStreamConfig {
  readonly apiBase: string;
  /** Optional bearer; if absent the request relies on cookie auth. */
  readonly bearer?: string;
  readonly handlers: CockpitStreamHandlers;
  readonly signal?: AbortSignal;
}

interface StreamReader {
  read(): Promise<{ value?: Uint8Array; done: boolean }>;
  cancel(): Promise<void>;
}

function asStreamReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): StreamReader {
  return {
    async read() {
      const { value, done } = await reader.read();
      return { value: value as Uint8Array | undefined, done };
    },
    async cancel() {
      await reader.cancel();
    },
  };
}

/**
 * Open the cockpit SSE channel. Returns a `close()` callback that
 * cleanly tears down the underlying fetch.
 */
export function openCockpitStream(config: CockpitStreamConfig): () => void {
  const controller = new AbortController();
  if (config.signal) {
    if (config.signal.aborted) controller.abort();
    else config.signal.addEventListener('abort', () => controller.abort());
  }
  const url = `${config.apiBase.replace(/\/$/, '')}/cockpit/stream`;

  let closed = false;
  let backoff = INITIAL_BACKOFF_MS;

  const runOnce = async (): Promise<void> => {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    };
    if (config.bearer) headers.Authorization = `Bearer ${config.bearer}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      throw err;
    }

    if (!response.ok || !response.body) {
      config.handlers.onClose?.();
      return;
    }

    config.handlers.onConnected?.();
    backoff = INITIAL_BACKOFF_MS;

    const reader = asStreamReader(response.body.getReader());
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          parseAndDispatch(raw, config.handlers);
        }
      }
    } finally {
      void reader.cancel();
      config.handlers.onClose?.();
    }
  };

  const loop = async (): Promise<void> => {
    while (!closed) {
      try {
        await runOnce();
      } catch {
        // Network blip; back off and try again.
      }
      if (closed) break;
      await new Promise<void>((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }
  };

  void loop();
  return () => {
    closed = true;
    controller.abort();
  };
}

function parseAndDispatch(
  block: string,
  handlers: CockpitStreamHandlers,
): void {
  const lines = block.split('\n');
  let kind: CockpitEventKind | null = null;
  let dataChunks: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      kind = line.slice(6).trim() as CockpitEventKind;
    } else if (line.startsWith('data:')) {
      dataChunks.push(line.slice(5).trimStart());
    }
  }
  if (!kind) return;
  const raw = dataChunks.join('\n');
  let parsed: unknown = null;
  try {
    parsed = raw.length > 0 ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }
  if (kind === 'connected') {
    handlers.onConnected?.();
    return;
  }
  if (kind === 'heartbeat') return;
  handlers.onEvent?.(kind, parsed);
}
