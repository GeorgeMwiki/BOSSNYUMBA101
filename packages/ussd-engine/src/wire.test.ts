import { describe, it, expect } from 'vitest';
import { wireUssdEngine, USSD_ENGINE_FLAG, type WireUssdEngineDeps } from './wire.js';
import { createInMemorySessionStore } from './in-memory-store.js';
import type { UssdDataPort, UssdIdentityResolver } from './ports.js';

function makeData(): UssdDataPort {
  return {
    fetchLease: async () => null,
    fetchRent: async () => null,
    fetchMaintenance: async () => null,
    fetchMarketplace: async () => [
      { unitEn: 'Studio A1', unitSw: 'Studio A1', priceDisplay: 'TZS 150k/mo' },
    ],
    recordMeterReading: async () => true,
  };
}

const identity: UssdIdentityResolver = {
  resolve: async () => ({ tenantId: 'tenant-1', actorId: 'actor-1', tier: 'owner' }),
};

function baseDeps(enabled: boolean): WireUssdEngineDeps {
  return {
    enabled,
    store: createInMemorySessionStore(),
    identity,
    data: makeData(),
    defaultLanguage: 'en',
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(USSD_ENGINE_FLAG).toBe('BOSSNYUMBA_FEATURE_USSD_ENGINE');
  });
});

describe('wireUssdEngine — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireUssdEngine(baseDeps(false))).toBeNull();
  });

  it('returns a bound engine when the flag is enabled', () => {
    const engine = wireUssdEngine(baseDeps(true));
    expect(engine).not.toBeNull();
    expect(typeof engine?.handle).toBe('function');
  });
});

describe('wireUssdEngine — bound handle', () => {
  it('renders the main menu on first dial through the facade', async () => {
    const engine = wireUssdEngine(baseDeps(true));
    const res = await engine!.handle({
      sessionId: 'w1',
      serviceCode: '*123#',
      phoneNumber: '+255700111222',
      text: '',
    });
    expect(res.isEnd).toBe(false);
    expect(res.message).toContain('BossNyumba');
  });

  it('rejects a malformed request with a terminal error screen (zod boundary)', async () => {
    const engine = wireUssdEngine(baseDeps(true));
    // Missing sessionId / serviceCode — must not throw.
    const res = await engine!.handle({
      sessionId: '',
      serviceCode: '',
      phoneNumber: '',
      text: '',
    });
    expect(res.isEnd).toBe(true);
    expect(res.message).toContain('Something went wrong');
  });
});
