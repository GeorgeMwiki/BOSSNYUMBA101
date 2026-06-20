/**
 * Depth-unbounded PII redaction detectors for the structured Logger.
 *
 * Pino's native `redact.paths` only reaches a FIXED number of wildcard
 * segments (the logger declared depths 0-2). Anything nested deeper —
 * `a.b.c.phone`, an array of objects, a phone inside an error payload —
 * used to leak. The Logger now runs the recursive `redactPII` walk over
 * the whole log object first, so a PII-named key is censored at ANY depth.
 *
 * We assert against the object the Logger hands to the underlying Pino
 * instance (spied), so the test is independent of transport/serialisation.
 */
import { describe, it, expect, vi } from 'vitest';
import { Logger } from './logger.js';
import type { ServiceIdentity } from '../types/telemetry.types.js';

const service: ServiceIdentity = {
  name: 'redaction-test',
  version: '1.0.0',
  environment: 'test',
};

function makeLogger() {
  const logger = new Logger({ service, level: 'trace', pretty: false });
  const pino = logger.getPino();
  const calls: Array<Record<string, unknown>> = [];
  for (const level of ['info', 'warn', 'error', 'fatal'] as const) {
    vi.spyOn(pino, level).mockImplementation(((obj: Record<string, unknown>) => {
      calls.push(obj);
      return undefined;
    }) as never);
  }
  return { logger, calls };
}

/** Walk a value and collect every string leaf, for "no PII survived" scans. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectStrings(v, out));
  }
  return out;
}

describe('Logger — depth-unbounded PII redaction', () => {
  it('redacts phone at depth 1 (baseline)', () => {
    const { logger, calls } = makeLogger();
    logger.info('msg', { phone: '+255700000001' });
    expect(JSON.stringify(calls[0])).not.toContain('+255700000001');
    expect(calls[0]?.phone).toBe('[REDACTED]');
  });

  it('redacts phone at depth 4 (beyond Pino static *.*.f reach)', () => {
    const { logger, calls } = makeLogger();
    logger.info('deep', {
      a: { b: { c: { phone: '+255700000004' } } },
    });
    const blob = JSON.stringify(calls[0]);
    expect(blob).not.toContain('+255700000004');
  });

  it('redacts phone at depth 6 (arbitrary depth)', () => {
    const { logger, calls } = makeLogger();
    logger.info('deeper', {
      a: { b: { c: { d: { e: { phone: '+255700000006' } } } } },
    });
    expect(JSON.stringify(calls[0])).not.toContain('+255700000006');
  });

  it('redacts phone nested inside arrays of objects', () => {
    const { logger, calls } = makeLogger();
    logger.info('array', {
      contacts: [
        { name: 'ok', phone: '+255700000010' },
        { nested: { phone_e164: '+255700000011' } },
      ],
    });
    const blob = JSON.stringify(calls[0]);
    expect(blob).not.toContain('+255700000010');
    expect(blob).not.toContain('+255700000011');
  });

  it('redacts snake_case phone variants at depth', () => {
    const { logger, calls } = makeLogger();
    logger.info('snake', { meta: { payload: { phone_normalized: '255700000020' } } });
    expect(JSON.stringify(calls[0])).not.toContain('255700000020');
  });

  it('redacts PII riding inside an error-path payload at depth', () => {
    const { logger, calls } = makeLogger();
    logger.error('boom', { context: { user: { email: 'leak@example.com' } } });
    expect(JSON.stringify(calls[0])).not.toContain('leak@example.com');
  });

  it('does NOT redact safe identifiers (tenantId / requestId survive)', () => {
    const base = new Logger({
      service,
      level: 'info',
      pretty: false,
      baseContext: { tenantId: 'tenant-keep', requestId: 'req-keep' },
    });
    const pino = base.getPino();
    const captured: Array<Record<string, unknown>> = [];
    vi.spyOn(pino, 'info').mockImplementation(((obj: Record<string, unknown>) => {
      captured.push(obj);
      return undefined;
    }) as never);
    base.info('safe', { action: 'view' });
    expect(captured[0]?.tenantId).toBe('tenant-keep');
    expect(captured[0]?.requestId).toBe('req-keep');
    expect(captured[0]?.action).toBe('view');
  });

  it('leaves non-PII deep strings intact while censoring PII siblings', () => {
    const { logger, calls } = makeLogger();
    logger.info('mixed', {
      a: { b: { keepMe: 'visible-value', phone: '+255700000030' } },
    });
    const strings = collectStrings(calls[0]);
    expect(strings).toContain('visible-value');
    expect(strings).not.toContain('+255700000030');
  });
});
