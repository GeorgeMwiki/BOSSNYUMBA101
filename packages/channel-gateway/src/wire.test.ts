import { describe, it, expect } from 'vitest';
import {
  wireChannelGateway,
  CHANNEL_GATEWAY_FLAG,
  type WireChannelGatewayDeps,
} from './wire.js';
import type { SignatureVerifier, TierResolver, Clock } from './ports.js';

const passVerifier: SignatureVerifier = { verify: () => true };

const ownerResolver: TierResolver = {
  resolve: async () => ({ tenantId: 'tenant-1', actorId: 'actor-1', tier: 'owner' }),
};

const fixedClock: Clock = { now: () => new Date('2026-06-03T10:00:00.000Z') };

function baseDeps(enabled: boolean): WireChannelGatewayDeps {
  return {
    enabled,
    signature: passVerifier,
    tier: ownerResolver,
    clock: fixedClock,
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(CHANNEL_GATEWAY_FLAG).toBe('BOSSNYUMBA_FEATURE_CHANNEL_GATEWAY');
  });
});

describe('wireChannelGateway — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireChannelGateway(baseDeps(false))).toBeNull();
  });

  it('returns a bound facade when the flag is enabled', () => {
    const gateway = wireChannelGateway(baseDeps(true));
    expect(gateway).not.toBeNull();
    expect(typeof gateway?.handle).toBe('function');
  });
});

describe('wireChannelGateway — bound handle', () => {
  it('canonicalizes a happy-path web message through the facade', async () => {
    const gateway = wireChannelGateway(baseDeps(true));
    const res = await gateway!.handle({
      channel: 'web',
      rawBody: 'x',
      headers: {},
      payload: { messageId: 'w1', userId: 'user-42', text: 'hello' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.event.channel).toBe('web');
      expect(res.event.sender.tier).toBe('owner');
      expect(res.event.signatureVerified).toBe(true);
    }
  });

  it('rejects a malformed input envelope via the zod boundary without throwing', async () => {
    const gateway = wireChannelGateway(baseDeps(true));
    // `channel` is not a valid ChannelKind and `headers` is missing — the zod
    // boundary must turn this into a typed rejection, never a throw.
    const res = await gateway!.handle({
      channel: 'carrier-pigeon',
      rawBody: 'x',
      payload: { text: 'hi' },
    } as never);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('malformed');
  });
});
