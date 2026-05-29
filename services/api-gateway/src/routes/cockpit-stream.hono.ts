/**
 * Cockpit Stream SSE route — Roadmap R6 (real-estate edition).
 *
 * `GET /api/v1/cockpit/stream` opens a Server-Sent Events channel for
 * the owner / manager / staff cockpits. The bus multiplexes every
 * cockpit event kind onto one per-tenant stream:
 *
 *   - decision.recorded
 *   - reminder.fired
 *   - opportunity.scan_completed
 *   - risk.changed
 *   - staff.shift_event
 *   - compliance.deadline_approaching
 *   - persona.acted / persona.proposes
 *   - rent.collected / lease.signed / lease.renewed / lease.terminated
 *   - maintenance.completed / maintenance.requested
 *   - inspection.completed / inspection.scheduled
 *   - application.submitted / application.approved / application.rejected
 *   - viewing.scheduled / viewing.completed
 *   - regulator.request_received / regulator.request_status_changed
 *   - rfa.dispatched / task.assigned / safety.incident_reported
 *   - rent_payout.initiated / payroll.committed / licence.renewed
 *   - chat.handoff / manager.approved / bid.placed / incident.escalated
 *   - cockpit.tab.{spawned,updated,removed,proposed}
 *   - property.celebrate
 *
 * Tenant isolation: scoped to `auth.tenantId` taken from the JWT.
 * Callers can NEVER pass a tenant id; the route silently refuses
 * 401 when the JWT lacks `tenantId`.
 *
 * Wire format: standard SSE — one `event: <kind>` + `data: <json>` per
 * push, plus a 25-second heartbeat comment frame to keep proxies from
 * idling the socket.
 *
 * Lifecycle:
 *   - On connect: emits `event: connected` so the client can render the
 *     green dot immediately.
 *   - Bridges bus events into the SSE wire through a bounded internal
 *     queue; if the client cannot keep up the route drops the oldest
 *     in-flight events rather than back-pressuring the bus.
 *   - Stream tears down on `stream.onAbort` — the bus subscription is
 *     released and the heartbeat cleared. Memory-safe.
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { authMiddleware } from '../middleware/hono-auth';
import {
  subscribeCockpitEvents,
  type CockpitEvent,
} from '../services/cockpit-events/index.js';

const HEARTBEAT_MS = 25_000;
const MAX_QUEUE = 256;

const app = new Hono();

app.get('/stream', authMiddleware, (c) => {
  const auth = c.get('auth') as { tenantId?: string } | undefined;
  const tenantId = auth?.tenantId;
  if (!tenantId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_REQUIRED',
          message:
            'auth.tenantId missing — cockpit stream requires a tenant scope',
        },
      },
      401,
    );
  }

  return streamSSE(c, async (stream) => {
    // Opening packet so the client knows the stream is live.
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        tenantId,
        openedAt: new Date().toISOString(),
      }),
    });

    // Bridge bus events into the SSE wire. Push errors are caught so
    // a single slow client never crashes the bus emit loop.
    const queue: CockpitEvent[] = [];
    let flushScheduled = false;

    const scheduleFlush = (): void => {
      if (flushScheduled) return;
      flushScheduled = true;
      queueMicrotask(async () => {
        flushScheduled = false;
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          try {
            await stream.writeSSE({
              event: next.kind,
              data: JSON.stringify(next),
            });
          } catch {
            // Client gone; drop the rest. The abort signal will
            // unsubscribe us in a moment.
            queue.length = 0;
            return;
          }
        }
      });
    };

    const unsubscribe = subscribeCockpitEvents(tenantId, (event) => {
      if (queue.length >= MAX_QUEUE) {
        // Slow consumer — drop the oldest to keep the queue bounded.
        queue.shift();
      }
      queue.push(event);
      scheduleFlush();
    });

    // Heartbeat — comment-only frame so the client sees no payload.
    const heartbeat = setInterval(() => {
      stream
        .writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ at: new Date().toISOString() }),
        })
        .catch(() => {
          // Client disconnected; the abort signal will tear down below.
        });
    }, HEARTBEAT_MS);
    // Make sure the heartbeat never holds the event loop open.
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    const cleanup = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    // Hold the connection open until the client aborts.
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        cleanup();
        resolve();
      });
    });
  });
});

export const cockpitStreamRouter = app;
export default cockpitStreamRouter;
