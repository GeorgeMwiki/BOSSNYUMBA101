import { describe, it, expect } from 'vitest';
import {
  wirePrivacyRouter,
  PRIVACY_ROUTER_FLAG,
  type WirePrivacyRouterDeps,
} from './wire.js';
import type {
  LocalEndpointHealthPort,
  PiiStripperPort,
  PrivacyClock,
} from './index.js';

const FIXED = new Date('2026-06-04T12:00:00.000Z');
const fixedClock: PrivacyClock = { now: () => FIXED };

const noPii: PiiStripperPort = {
  containsPii: () => false,
  stripPii: (text) => ({ stripped: text, mappings: {} }),
};

const healthy: LocalEndpointHealthPort = { isHealthy: async () => true };

function baseDeps(enabled: boolean): WirePrivacyRouterDeps {
  return {
    enabled,
    pii: noPii,
    localHealth: healthy,
    clock: fixedClock,
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(PRIVACY_ROUTER_FLAG).toBe('BOSSNYUMBA_FEATURE_PRIVACY_ROUTER');
  });
});

describe('wirePrivacyRouter — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wirePrivacyRouter(baseDeps(false))).toBeNull();
  });

  it('returns a bound facade when the flag is enabled', () => {
    const facade = wirePrivacyRouter(baseDeps(true));
    expect(facade).not.toBeNull();
    expect(typeof facade?.handle).toBe('function');
  });
});

describe('wirePrivacyRouter — bound handle', () => {
  it('routes a happy-path PUBLIC request through the facade', async () => {
    const facade = wirePrivacyRouter(baseDeps(true));
    const res = await facade!.handle({
      text: 'hello world',
      taskCategory: 'blog_generation',
    });
    expect(res.endpoint).toBe('claude');
    expect(res.classification).toBe('PUBLIC');
    expect(res.piiStripped).toBe(false);
    expect(res.processedText).toBe('hello world');
  });

  it('rejects a malformed request fail-closed (zod boundary, no throw)', async () => {
    const facade = wirePrivacyRouter(baseDeps(true));
    // `text` is not a string and `taskCategory` is unknown — must not throw.
    const res = await facade!.handle({
      text: 123 as unknown as string,
      taskCategory: 'not_a_category' as never,
    });
    expect(res.endpoint).toBe('DENIED');
    expect(res.classification).toBe('RESTRICTED');
    expect(res.reason).toMatch(/Malformed/);
  });
});
