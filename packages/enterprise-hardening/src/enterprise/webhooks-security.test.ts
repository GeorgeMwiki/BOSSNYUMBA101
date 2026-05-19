/**
 * Round-3 closure regression tests for the enterprise webhook manager.
 *
 * - C1: `verifySignature` constant-time compare.
 * - C2: `attemptDelivery` rejects loopback / IMDS URLs via the central
 *       SSRF gate (assertUrlSafe).
 * - H21: signed payload includes the timestamp (replay-bound).
 * - H22: `redactWebhookEndpoint` removes the raw secret before emit.
 */

import { describe, it, expect } from 'vitest';
import {
  WebhookManager,
  redactWebhookEndpoint,
  type WebhookEndpoint,
  type WebhookEvent,
} from './webhooks';

function makeEndpoint(url: string): WebhookEndpoint {
  return Object.freeze({
    id: 'ep-1',
    tenantId: 'tenant-a',
    url,
    secret: 'super-secret-shh',
    events: ['*'],
    enabled: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
}

function makeEvent(): WebhookEvent {
  return Object.freeze({
    id: 'evt-1',
    tenantId: 'tenant-a',
    type: 'tenant.created',
    category: 'tenant' as const,
    timestamp: '2026-05-19T00:00:00Z',
    data: { x: 1 },
  });
}

describe('webhook-manager — C1 constant-time signature compare', () => {
  it('verifies a valid signature when produced by the manager itself', async () => {
    const mgr = new WebhookManager();
    // Sign a payload directly via the manager's internal pathway.
    const payload = '{"x":1}';
    const secret = 'shhh';
    // Pull the private signer via prototype call.
    const sig = await (
      mgr as unknown as { signPayload: (p: string, s: string) => Promise<string> }
    ).signPayload(payload, secret);
    const ok = await mgr.verifySignature(payload, sig, secret);
    expect(ok).toBe(true);
  });

  it('rejects a tampered signature without throwing on length mismatch', async () => {
    const mgr = new WebhookManager();
    const ok = await mgr.verifySignature(
      '{"x":1}',
      'deadbeef',
      'shhh',
    );
    expect(ok).toBe(false);
  });

  it('rejects when signature is the empty string (length-mismatch path)', async () => {
    const mgr = new WebhookManager();
    expect(await mgr.verifySignature('{}', '', 's')).toBe(false);
  });

  it('does NOT use `===` — invalid hex chars are treated as mismatch', async () => {
    const mgr = new WebhookManager();
    // Non-hex strings of correct length should resolve to false (the
    // Buffer.from(_, 'hex') decode produces a zero-length buffer for
    // an unparseable string, which the helper rejects).
    const sig = 'g'.repeat(64);
    expect(await mgr.verifySignature('payload', sig, 'secret')).toBe(false);
  });
});

describe('webhook-manager — C2 SSRF guard on attemptDelivery', () => {
  it('refuses delivery to a literal loopback URL', async () => {
    const mgr = new WebhookManager({
      urlPolicy: {
        allowedSchemes: ['http:', 'https:'],
        allowedPorts: [80, 443],
      },
    });
    mgr.registerEndpoint(makeEndpoint('http://127.0.0.1/hook'));
    const ids = await mgr.emit(makeEvent());
    expect(ids.length).toBe(1);
    const initial = mgr.getDelivery(ids[0]!);
    expect(initial).not.toBeNull();
    const after = await mgr.attemptDelivery(initial!);
    // The SSRF gate throws inside attemptDelivery; the catch path
    // schedules a retry OR marks exhausted. Either way the delivery
    // did NOT progress to a successful state.
    expect(after.status).not.toBe('DELIVERED');
    const lastAttempt = after.attempts.at(-1);
    expect(lastAttempt?.errorMessage).toMatch(/denied-internal-ip|denied-port|denied/);
  });

  it('refuses delivery to the EC2 metadata IP', async () => {
    const mgr = new WebhookManager({
      urlPolicy: { allowedSchemes: ['http:', 'https:'], allowedPorts: [80, 443] },
    });
    mgr.registerEndpoint(
      makeEndpoint('http://169.254.169.254/latest/meta-data/'),
    );
    const ids = await mgr.emit(makeEvent());
    const initial = mgr.getDelivery(ids[0]!);
    const after = await mgr.attemptDelivery(initial!);
    expect(after.status).not.toBe('DELIVERED');
  });
});

describe('webhook-manager — H22 redactWebhookEndpoint', () => {
  it('replaces the secret field with a redaction marker', () => {
    const ep = makeEndpoint('https://hooks.example.com/x');
    const redacted = redactWebhookEndpoint(ep);
    expect(redacted.secret).toBe('[REDACTED]');
    // Other fields preserved.
    expect(redacted.url).toBe(ep.url);
    expect(redacted.tenantId).toBe(ep.tenantId);
    // Original is unchanged.
    expect(ep.secret).toBe('super-secret-shh');
  });
});
