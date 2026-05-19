/**
 * trace-logger + 4-layer PII redaction regression tests.
 *
 * Covers:
 *   - regex layer redacts email/phone/MSISDN/KE-ID/TZ-NIDA/ZA-RSA-ID
 *   - ML layer port is invoked
 *   - canary HIT quarantines and aborts before storage
 *   - consent=false flags the audit but still stores
 *   - storage-tier function maps age → hot/warm/cold correctly
 *   - logTrace is idempotent on (tenantId, turnId)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  redactByRegex,
  applyConsentGate,
  makeRedactionPipeline,
  logTrace,
  storageTierFor,
  type MLRedactor,
  type CanaryChecker,
  type TraceLoggerPorts,
  type TraceEventStore,
  type LogTraceInput,
} from '../trace-logger/index.js';
import type { TraceEvent } from '../types.js';

// ────────────────────────────── helpers ──────────────────────────────

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLOCK_AT = new Date('2026-05-19T08:00:00Z');

function mkClock(at = CLOCK_AT): () => Date {
  return () => at;
}

function mkMockML(passthrough = true): MLRedactor {
  return {
    redact: vi.fn(async (input) => ({
      redacted: passthrough ? input.content : `${input.content} [ml-redacted]`,
      fired: !passthrough,
    })),
  };
}

function mkMockCanary(hits = 0): CanaryChecker {
  return {
    detect: vi.fn(async () => ({
      hits,
      canaryIds: hits > 0 ? ['canary-1'] : [],
    })),
  };
}

function mkMockStore(): TraceEventStore & {
  __rows: TraceEvent[];
} {
  const rows: TraceEvent[] = [];
  return {
    __rows: rows,
    upsertIfAbsent: vi.fn(async (event) => {
      const existing = rows.find(
        (r) => r.tenantId === event.tenantId && r.turnId === event.turnId,
      );
      if (existing) return { inserted: false };
      rows.push(event);
      return { inserted: true };
    }),
    exists: vi.fn(async (args) =>
      rows.some((r) => r.tenantId === args.tenantId && r.turnId === args.turnId),
    ),
  };
}

function mkPorts(opts?: {
  ml?: MLRedactor;
  canary?: CanaryChecker;
  store?: ReturnType<typeof mkMockStore>;
  clock?: () => Date;
}): TraceLoggerPorts & { __store: ReturnType<typeof mkMockStore> } {
  const store = opts?.store ?? mkMockStore();
  const ml = opts?.ml ?? mkMockML();
  const canary = opts?.canary ?? mkMockCanary();
  const clock = opts?.clock ?? mkClock();
  const redaction = makeRedactionPipeline({
    ml,
    canary,
    config: {
      modelVersion: 'haiku-4.5-test',
      policyVersion: 'pii-2026.05',
      clock,
    },
  });
  return {
    redaction,
    store,
    clock,
    __store: store,
  };
}

function mkInput(overrides?: Partial<LogTraceInput>): LogTraceInput {
  return {
    tenantId: TENANT,
    conversationId: 'conv-1',
    turnId: 'turn-1',
    turn: 1,
    role: 'owner',
    content: 'hello',
    consentForTraining: true,
    actorId: 'kernel-adapter',
    ...overrides,
  };
}

// ────────────────────────── Layer 1: regex ───────────────────────────

describe('redactByRegex (Layer 1)', () => {
  it('redacts email addresses', () => {
    const result = redactByRegex('Contact me at alice@example.com please');
    expect(result.redacted).toContain('<email>');
    expect(result.fired).toBe(true);
  });

  it('redacts M-Pesa MSISDN before generic phone', () => {
    const result = redactByRegex('M-Pesa to +254 712 345 678 now');
    expect(result.redacted).toContain('<msisdn>');
    expect(result.fired).toBe(true);
  });

  it('redacts KE national-ID (8 digits)', () => {
    const result = redactByRegex('ID 12345678 confirmed');
    expect(result.redacted).toContain('<ke_id>');
  });

  it('redacts TZ NIDA (20 digits)', () => {
    const result = redactByRegex('NIDA 19850101142345678901 issued');
    expect(result.redacted).toContain('<tz_nida>');
  });

  it('redacts ZA RSA-ID (13 digits)', () => {
    const result = redactByRegex('SA ID 8506157890123 verified');
    expect(result.redacted).toContain('<za_id>');
  });

  it('redacts credit card-like 16-digit runs', () => {
    const result = redactByRegex('Card 4532 1234 5678 9012 expires');
    expect(result.redacted).toContain('<card>');
  });

  it('returns fired=false when no PII present', () => {
    const result = redactByRegex('totally clean message');
    expect(result.fired).toBe(false);
    expect(result.redacted).toBe('totally clean message');
  });
});

// ─────────────────────── Layer 4: consent gate ───────────────────────

describe('applyConsentGate (Layer 4)', () => {
  it('pass-through when consent granted', () => {
    expect(applyConsentGate({ consentForTraining: true })).toEqual({
      fired: false,
      action: 'pass-through',
    });
  });

  it('flags redaction when consent denied', () => {
    expect(applyConsentGate({ consentForTraining: false })).toEqual({
      fired: true,
      action: 'redacted',
    });
  });
});

// ──────────────────────── full pipeline ──────────────────────────────

describe('makeRedactionPipeline (composed)', () => {
  it('runs regex + ml + canary + consent in order', async () => {
    const ml = mkMockML(false); // ml fires
    const canary = mkMockCanary(0);
    const pipeline = makeRedactionPipeline({
      ml,
      canary,
      config: {
        modelVersion: 'haiku-4.5',
        policyVersion: 'v1',
        clock: mkClock(),
      },
    });
    const out = await pipeline.run({
      tenantId: TENANT,
      content: 'reach me at bob@example.com',
      consentForTraining: false,
      actorId: 'a1',
    });
    expect(out.quarantined).toBe(false);
    expect(out.audit.action).toBe('redacted');
    expect(out.audit.layersFired).toEqual(['regex', 'ml', 'consent']);
  });

  it('canary hit → quarantined; downstream MUST NOT persist', async () => {
    const canary = mkMockCanary(1);
    const pipeline = makeRedactionPipeline({
      ml: mkMockML(),
      canary,
      config: {
        modelVersion: 'haiku-4.5',
        policyVersion: 'v1',
        clock: mkClock(),
      },
    });
    const out = await pipeline.run({
      tenantId: TENANT,
      content: 'leaks canary token AUDIT-CANARY-xyz',
      consentForTraining: true,
      actorId: 'a1',
    });
    expect(out.quarantined).toBe(true);
    expect(out.redactedContent).toBe('');
    expect(out.audit.action).toBe('quarantined');
    expect(out.audit.layersFired).toContain('canary');
  });

  it('pass-through when no layer fires', async () => {
    const pipeline = makeRedactionPipeline({
      ml: mkMockML(true),
      canary: mkMockCanary(0),
      config: {
        modelVersion: 'haiku-4.5',
        policyVersion: 'v1',
        clock: mkClock(),
      },
    });
    const out = await pipeline.run({
      tenantId: TENANT,
      content: 'totally fine',
      consentForTraining: true,
      actorId: 'a1',
    });
    expect(out.audit.action).toBe('pass-through');
    expect(out.audit.layersFired.length).toBe(0);
  });

  it('audit stamps NIST RMF fields (model, policy, timestamp, actor)', async () => {
    const at = new Date('2026-05-19T08:00:00Z');
    const pipeline = makeRedactionPipeline({
      ml: mkMockML(),
      canary: mkMockCanary(),
      config: {
        modelVersion: 'haiku-4.5',
        policyVersion: 'pii-2026.05',
        clock: () => at,
      },
    });
    const out = await pipeline.run({
      tenantId: TENANT,
      content: 'x',
      consentForTraining: true,
      actorId: 'kernel-adapter',
    });
    expect(out.audit.modelVersion).toBe('haiku-4.5');
    expect(out.audit.policyVersion).toBe('pii-2026.05');
    expect(out.audit.redactedAt).toBe(at.toISOString());
    expect(out.audit.actorId).toBe('kernel-adapter');
  });
});

// ────────────────────────── storage tiering ──────────────────────────

describe('storageTierFor', () => {
  it('age 0 days → hot', () => {
    const t = new Date('2026-05-19T00:00:00Z');
    expect(storageTierFor({ loggedAt: t, now: t })).toBe('hot');
  });
  it('age 7 days → hot (boundary)', () => {
    const logged = new Date('2026-05-12T00:00:00Z');
    const now = new Date('2026-05-19T00:00:00Z');
    expect(storageTierFor({ loggedAt: logged, now })).toBe('hot');
  });
  it('age 8 days → warm', () => {
    const logged = new Date('2026-05-11T00:00:00Z');
    const now = new Date('2026-05-19T00:00:00Z');
    expect(storageTierFor({ loggedAt: logged, now })).toBe('warm');
  });
  it('age 90 days → warm (boundary)', () => {
    const logged = new Date('2026-02-18T00:00:00Z');
    const now = new Date('2026-05-19T00:00:00Z');
    expect(storageTierFor({ loggedAt: logged, now })).toBe('warm');
  });
  it('age 91 days → cold', () => {
    const logged = new Date('2026-02-17T00:00:00Z');
    const now = new Date('2026-05-19T00:00:00Z');
    expect(storageTierFor({ loggedAt: logged, now })).toBe('cold');
  });
  it('clock skew (loggedAt > now) defaults to hot', () => {
    const logged = new Date('2026-05-20T00:00:00Z');
    const now = new Date('2026-05-19T00:00:00Z');
    expect(storageTierFor({ loggedAt: logged, now })).toBe('hot');
  });
});

// ─────────────────────────── logTrace ────────────────────────────────

describe('logTrace', () => {
  it('writes a redacted event with hot tier when fresh', async () => {
    const ports = mkPorts();
    const result = await logTrace(
      ports,
      mkInput({ content: 'send mail to ada@example.com' }),
    );
    expect(result.inserted).toBe(true);
    expect(result.quarantined).toBe(false);
    expect(result.storageTier).toBe('hot');
    expect(ports.__store.__rows.length).toBe(1);
    expect(ports.__store.__rows[0].content).toContain('<email>');
    expect(ports.__store.__rows[0].content).not.toContain('ada@example.com');
  });

  it('quarantined trace is NEVER persisted', async () => {
    const ports = mkPorts({ canary: mkMockCanary(1) });
    const result = await logTrace(ports, mkInput());
    expect(result.quarantined).toBe(true);
    expect(result.inserted).toBe(false);
    expect(ports.__store.__rows.length).toBe(0);
  });

  it('idempotent on (tenantId, turnId) — second call inserts=false', async () => {
    const ports = mkPorts();
    await logTrace(ports, mkInput());
    const second = await logTrace(ports, mkInput());
    expect(second.inserted).toBe(false);
    expect(ports.__store.__rows.length).toBe(1);
  });

  it('preserves outcome and tool calls', async () => {
    const ports = mkPorts();
    await logTrace(
      ports,
      mkInput({
        outcome: 'closed-success',
        toolCalls: [
          {
            toolName: 'rent-charge',
            argsRedacted: '{"tenantId":"<redacted>"}',
            success: true,
          },
        ],
      }),
    );
    const row = ports.__store.__rows[0];
    expect(row.outcome).toBe('closed-success');
    expect(row.toolCalls?.length).toBe(1);
    expect(row.toolCalls?.[0].toolName).toBe('rent-charge');
  });

  it('flags consentForTraining=false in the audit', async () => {
    const ports = mkPorts();
    await logTrace(
      ports,
      mkInput({ consentForTraining: false }),
    );
    const row = ports.__store.__rows[0];
    expect(row.consentForTraining).toBe(false);
    expect(row.redaction.layersFired).toContain('consent');
  });
});
