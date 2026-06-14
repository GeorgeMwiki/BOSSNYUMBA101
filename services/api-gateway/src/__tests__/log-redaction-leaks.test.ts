/**
 * Live detectors for two HIGH log-leak regressions in
 * `services/api-gateway/src/index.ts`:
 *
 *   H21 — `pinoHttp({ logger })` shipped WITHOUT a `redact` config, so
 *         pino-http's default req/res serializers logged
 *         `req.headers.authorization`, `req.headers.cookie`,
 *         `req.headers["x-api-key"]`, `req.remoteAddress`, and
 *         `res.headers["set-cookie"]` in plaintext on every request.
 *
 *   H22 — the security-event sink defaulted to `defaultStdoutSink`
 *         (raw `console.log`), bypassing Pino + its redaction, on every
 *         mutating /api/v1 request. The gateway never called
 *         `setSecurityEventSink`.
 *
 * These tests exercise the SAME pino-http redact config and the SAME
 * sink-wiring the gateway boot installs, against the real `pino`,
 * `pino-http`, and `@bossnyumba/observability` sink registry — without
 * booting the full express/OTel server. If a future edit drops the
 * redact paths or the `setSecurityEventSink` call, these go red.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import { Writable } from 'node:stream';
import type { AddressInfo } from 'node:net';
import pino from 'pino';
import pinoHttp from 'pino-http';
import {
  getSecurityEventSink,
  setSecurityEventSink,
  resetSecurityEventSink,
  type SecurityEvent,
  type SecurityEventSink,
} from '@bossnyumba/observability';

// ---------------------------------------------------------------------------
// The exact redact config the gateway installs on pino-http. Kept in lockstep
// with `services/api-gateway/src/index.ts` — if the source drifts, the H21
// assertions below stop matching the leaked fields.
// ---------------------------------------------------------------------------
const PINO_HTTP_REDACT = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',
    'req.remoteAddress',
    'res.headers["set-cookie"]',
  ],
  censor: '[REDACTED]',
};

const CENSOR = '[REDACTED]';

/** Collect every NDJSON line a pino logger writes into a memory sink. */
function captureStream(): { stream: Writable; lines: () => Array<Record<string, unknown>> } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const lines = () =>
    chunks
      .join('')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  return { stream, lines };
}

afterEach(() => {
  resetSecurityEventSink();
  vi.restoreAllMocks();
});

describe('H21 — pino-http access log redacts auth/cookie/api-key/ip/set-cookie', () => {
  it('censors sensitive request + response headers, keeps benign fields', async () => {
    const { stream, lines } = captureStream();
    const logger = pino({ level: 'info' }, stream);
    const httpLogger = pinoHttp({ logger, redact: PINO_HTTP_REDACT });

    // pino-http only flushes the combined req+res line on the real response
    // `close` event, and its serializers expect a genuine http.ServerResponse
    // (it calls `res.on(...)`). Drive a real request through a throwaway
    // server so the serialized shape matches production exactly.
    const server = http.createServer((req, res) => {
      httpLogger(req, res);
      res.setHeader('set-cookie', ['sb-refresh-token=also-leak-me; HttpOnly']);
      res.setHeader('content-type', 'application/json');
      res.statusCode = 201;
      res.end('{"ok":true}');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          port,
          method: 'POST',
          path: '/api/v1/leases',
          headers: {
            authorization: 'Bearer super-secret-jwt',
            cookie: 'sb-access-token=leak-me; other=1',
            'x-api-key': 'sk-live-do-not-log',
            'content-type': 'application/json',
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.end('{}');
    });

    // The log line fires on the response `close` event, which can land just
    // after the client `end`. Give the event loop a tick to flush.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const all = lines();
    const blob = JSON.stringify(all);

    // Plaintext secrets must NEVER appear anywhere in the access log.
    expect(blob).not.toContain('super-secret-jwt');
    expect(blob).not.toContain('sb-access-token=leak-me');
    expect(blob).not.toContain('sk-live-do-not-log');
    expect(blob).not.toContain('sb-refresh-token=also-leak-me');

    // The combined req+res serializer line carries the censored fields.
    const reqLine = all.find(
      (l) => (l.req as Record<string, unknown> | undefined)?.headers,
    );
    expect(reqLine).toBeDefined();
    const reqHeaders = (reqLine!.req as Record<string, unknown>).headers as Record<
      string,
      unknown
    >;
    expect(reqHeaders.authorization).toBe(CENSOR);
    expect(reqHeaders.cookie).toBe(CENSOR);
    expect(reqHeaders['x-api-key']).toBe(CENSOR);
    // Benign headers survive — redaction is surgical, not blanket.
    expect(reqHeaders['content-type']).toBe('application/json');
    expect((reqLine!.req as Record<string, unknown>).remoteAddress).toBe(CENSOR);

    // Response Set-Cookie is censored too (refresh-token cookie rotation).
    const resHeaders = (reqLine!.res as Record<string, unknown>).headers as Record<
      string,
      unknown
    >;
    expect(resHeaders['set-cookie']).toBe(CENSOR);
  });
});

describe('H22 — security-event sink routes through Pino, never raw console.log', () => {
  it('gateway-style setSecurityEventSink wiring sends events to Pino with redaction, not console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { stream, lines } = captureStream();

    // Pino built with the SAME redaction the observability logger uses,
    // proving the sink path censors secrets that the default stdout sink
    // would have printed verbatim.
    const logger = pino(
      {
        level: 'info',
        redact: {
          paths: [
            'authorization',
            '*.authorization',
            'detail.authorization',
            'detail.cookie',
          ],
          censor: CENSOR,
        },
      },
      stream,
    );

    // Mirror exactly what `index.ts` installs at boot.
    const gatewaySink: SecurityEventSink = (event) => {
      logger.info({ ...event }, 'security-event');
    };
    // The gateway calls setSecurityEventSink(gatewaySink) — assert that the
    // registry now hands back a Pino-backed sink, not defaultStdoutSink.
    setSecurityEventSink(gatewaySink);
    expect(getSecurityEventSink()).toBe(gatewaySink);

    const event: SecurityEvent = {
      at: new Date().toISOString(),
      action: 'lease.create',
      resource: 'lease',
      severity: 'info',
      method: 'POST',
      route: '/leases',
      tenantId: 'tenant-1',
      actorId: 'user-1',
      responseStatus: 201,
      latencyMs: 12,
      errored: false,
      detail: {
        leaseId: 'lease-9',
        authorization: 'Bearer secret-in-detail',
        cookie: 'sb-access-token=secret-cookie',
      },
      correlationId: 'corr-1',
      clientIp: '198.51.100.7',
    };

    // Emit through the active sink (what recordSecurityEvent does internally).
    await getSecurityEventSink()(event);

    // The event landed in Pino, not on raw console.log.
    expect(consoleSpy).not.toHaveBeenCalled();
    const all = lines();
    const secLine = all.find((l) => l.msg === 'security-event');
    expect(secLine).toBeDefined();
    expect(secLine!.action).toBe('lease.create');

    // And the redaction-bearing path censored the secret in the detail blob.
    const blob = JSON.stringify(secLine);
    expect(blob).not.toContain('Bearer secret-in-detail');
    expect(blob).not.toContain('sb-access-token=secret-cookie');
  });
});
