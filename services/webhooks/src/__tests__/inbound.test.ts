import { describe, it, expect, beforeEach } from 'vitest';
import CryptoJS from 'crypto-js';
import {
  InboundWebhookRouter,
  InMemoryAuditStore,
  InMemoryDedupStore,
  InMemoryDLQ,
  verifySignature,
  extractEventId,
  type EventHandler,
  type SignatureConfig,
} from '../inbound.js';

function hmacHex(body: string, secret: string): string {
  return CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex);
}

describe('verifySignature', () => {
  const cfg: SignatureConfig = {
    provider: 'airtel',
    secret: 's3cr3t',
    header: 'X-Sig',
  };

  it('accepts a plain HMAC-SHA256 hex signature', () => {
    const body = '{"hello":"world"}';
    const sig = hmacHex(body, cfg.secret);
    const result = verifySignature(cfg, { 'X-Sig': sig }, body);
    expect(result.valid).toBe(true);
  });

  it('accepts a "sha256=" prefixed signature', () => {
    const body = '{"hello":"world"}';
    const sig = `sha256=${hmacHex(body, cfg.secret)}`;
    const result = verifySignature(cfg, { 'X-Sig': sig }, body);
    expect(result.valid).toBe(true);
  });

  it('rejects a bad signature', () => {
    const result = verifySignature(cfg, { 'X-Sig': 'deadbeef' }, '{"a":1}');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature-mismatch');
  });

  it('rejects when header is missing', () => {
    const result = verifySignature(cfg, {}, '{"a":1}');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing-signature-header');
  });

  it('verifies Stripe-style t=,v1= signatures with timestamp window', () => {
    const body = '{"stripe":"event"}';
    const now = new Date('2024-04-01T00:00:00Z');
    const ts = Math.floor(now.getTime() / 1000);
    const secret = 'whsec_test';
    const v1 = hmacHex(`${ts}.${body}`, secret);
    const stripeCfg: SignatureConfig = {
      provider: 'stripe',
      secret,
      header: 'Stripe-Signature',
      maxSkewSeconds: 300,
    };
    const result = verifySignature(
      stripeCfg,
      { 'Stripe-Signature': `t=${ts},v1=${v1}` },
      body,
      now
    );
    expect(result.valid).toBe(true);
  });

  it('rejects stale Stripe timestamps outside skew window', () => {
    const body = '{"stripe":"event"}';
    const now = new Date('2024-04-01T00:10:00Z');
    const ts = Math.floor(new Date('2024-04-01T00:00:00Z').getTime() / 1000);
    const secret = 'whsec_test';
    const v1 = hmacHex(`${ts}.${body}`, secret);
    const stripeCfg: SignatureConfig = {
      provider: 'stripe',
      secret,
      header: 'Stripe-Signature',
      maxSkewSeconds: 300,
    };
    const result = verifySignature(
      stripeCfg,
      { 'Stripe-Signature': `t=${ts},v1=${v1}` },
      body,
      now
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('timestamp-skew-exceeded');
  });
});

describe('extractEventId', () => {
  it('extracts Stripe event id', () => {
    expect(extractEventId('stripe', { id: 'evt_123' }, '{}')).toBe('evt_123');
  });

  it('extracts M-Pesa STK CheckoutRequestID', () => {
    const body = { Body: { stkCallback: { CheckoutRequestID: 'cr_1' } } };
    expect(extractEventId('mpesa', body, '{}')).toBe('stk:cr_1');
  });

  it('extracts M-Pesa B2C ConversationID', () => {
    const body = { Result: { ConversationID: 'conv_1' } };
    expect(extractEventId('mpesa', body, '{}')).toBe('b2c:conv_1');
  });

  it('falls back to sha256 of raw body', () => {
    expect(extractEventId('mpesa', {}, 'abc')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('InboundWebhookRouter', () => {
  let audit: InMemoryAuditStore;
  let dedup: InMemoryDedupStore;
  let dlq: InMemoryDLQ;

  beforeEach(() => {
    audit = new InMemoryAuditStore();
    dedup = new InMemoryDedupStore();
    dlq = new InMemoryDLQ();
  });

  it('processes a valid event exactly once', async () => {
    const handler: EventHandler = async () => ({ ok: true });
    const router = new InboundWebhookRouter({
      audit,
      dedup,
      dlq,
      signatures: {},
      handlers: { stripe: handler },
    });

    const body = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded' });
    const r1 = await router.handle('stripe', {}, body);
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ ok: true });

    const r2 = await router.handle('stripe', {}, body);
    expect(r2.status).toBe(200);
    expect(r2.body).toMatchObject({ duplicate: true });

    const processed = await audit.list({ outcome: 'processed' });
    expect(processed.length).toBe(1);
    const dup = await audit.list({ outcome: 'duplicate' });
    expect(dup.length).toBe(1);
  });

  it('rejects events with invalid signatures', async () => {
    const handler: EventHandler = async () => ({ ok: true });
    const router = new InboundWebhookRouter({
      audit,
      dedup,
      dlq,
      signatures: {
        airtel: { provider: 'airtel', secret: 'abc', header: 'X-Sig' },
      },
      handlers: { airtel: handler },
    });

    const body = '{"a":1}';
    const result = await router.handle('airtel', { 'X-Sig': 'bad' }, body);
    expect(result.status).toBe(401);
    const rejected = await audit.list({ outcome: 'rejected' });
    expect(rejected.length).toBe(1);
  });

  it('sends persistently-failing handlers to DLQ', async () => {
    const handler: EventHandler = async () => ({
      ok: false,
      retryable: true,
      error: 'boom',
    });
    const router = new InboundWebhookRouter({
      audit,
      dedup,
      dlq,
      signatures: {},
      handlers: { mpesa: handler },
      maxAttempts: 2,
      retryDelayMs: 1,
    });

    const body = JSON.stringify({
      Body: { stkCallback: { CheckoutRequestID: 'X' } },
    });
    const result = await router.handle('mpesa', {}, body);
    expect(result.body).toMatchObject({ deadLettered: true });
    const dead = await dlq.list();
    expect(dead.length).toBe(1);
    expect(dead[0]!.attempts).toBe(2);
  });

  it('stops retrying non-retryable failures', async () => {
    let calls = 0;
    const handler: EventHandler = async () => {
      calls++;
      return { ok: false, retryable: false, error: 'permanent' };
    };
    const router = new InboundWebhookRouter({
      audit,
      dedup,
      dlq,
      signatures: {},
      handlers: { tigopesa: handler },
      maxAttempts: 5,
      retryDelayMs: 1,
    });
    const body = JSON.stringify({ TXNID: 'tz1' });
    await router.handle('tigopesa', {}, body);
    expect(calls).toBe(1);
    const dead = await dlq.list();
    expect(dead.length).toBe(1);
  });
});
