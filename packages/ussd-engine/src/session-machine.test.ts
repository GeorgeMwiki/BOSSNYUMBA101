import { describe, it, expect } from 'vitest';
import {
  handleUssdRequest,
  extractLatestInput,
  type UssdEngineDeps,
} from './session-machine.js';
import { createInMemorySessionStore } from './in-memory-store.js';
import type {
  UssdDataPort,
  UssdIdentityResolver,
  UssdClock,
} from './ports.js';
import type { UssdRequest, UssdTier } from './types.js';

// ----------------------------------------------------------------------------
// Test doubles
// ----------------------------------------------------------------------------

function fixedClock(iso = '2026-06-03T10:00:00.000Z'): { clock: UssdClock; advance: (ms: number) => void } {
  let current = Date.parse(iso);
  return {
    clock: { now: () => new Date(current) },
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function identityFor(tier: UssdTier): UssdIdentityResolver {
  return {
    resolve: async () => ({
      tenantId: tier === 'anonymous' ? null : 'tenant-1',
      actorId: tier === 'anonymous' ? null : 'actor-1',
      tier,
    }),
  };
}

function makeData(overrides: Partial<UssdDataPort> = {}): UssdDataPort {
  return {
    fetchLease: async () => ({
      leaseRef: 'LSE-00421',
      statusEn: 'Active',
      statusSw: 'Hai',
      expiresOn: '2027-01-15',
      daysToExpiry: 590,
    }),
    fetchRent: async () => ({
      periodLabel: 'May 2026',
      amountDueDisplay: 'TZS 1,200,000',
      amountPaidDisplay: 'TZS 0',
      nextActionEn: 'Pay before 30th',
      nextActionSw: 'Lipa kabla ya 30',
    }),
    fetchMaintenance: async () => null,
    fetchMarketplace: async () => [
      { unitEn: 'Studio A1', unitSw: 'Studio A1', priceDisplay: 'TZS 150k/mo' },
    ],
    recordMeterReading: async () => true,
    ...overrides,
  };
}

function depsFor(
  tier: UssdTier,
  data: UssdDataPort = makeData(),
  clock?: UssdClock,
): UssdEngineDeps {
  return {
    store: createInMemorySessionStore(clock ? { clock } : {}),
    identity: identityFor(tier),
    data,
    defaultLanguage: 'en',
    ...(clock ? { clock } : {}),
  };
}

function req(sessionId: string, text: string): UssdRequest {
  return {
    sessionId,
    serviceCode: '*123#',
    phoneNumber: '+255700111222',
    text,
  };
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('extractLatestInput', () => {
  it('returns empty for first dial', () => {
    expect(extractLatestInput('')).toBe('');
  });
  it('returns the last segment of cumulative text', () => {
    expect(extractLatestInput('1*2*3')).toBe('3');
  });
});

describe('first dial', () => {
  it('shows the owner main menu and does not end the session', async () => {
    const deps = depsFor('owner');
    const res = await handleUssdRequest(req('s1', ''), deps);
    expect(res.isEnd).toBe(false);
    expect(res.message).toContain('BossNyumba');
    expect(res.message).toContain('Rent Due');
  });

  it('shows only the public menu to an anonymous caller', async () => {
    const deps = depsFor('anonymous');
    const res = await handleUssdRequest(req('s-anon', ''), deps);
    expect(res.message).toContain('Vacant Units');
    expect(res.message).not.toContain('My Lease');
  });
});

describe('navigation', () => {
  it('owner picks rent and sees the detail screen', async () => {
    const deps = depsFor('owner');
    await handleUssdRequest(req('s2', ''), deps);
    const res = await handleUssdRequest(req('s2', '2'), deps);
    expect(res.message).toContain('TZS 1,200,000');
    expect(res.message).toContain('Pay before 30th');
  });

  it('"0" returns from a sub-screen to the main menu', async () => {
    const deps = depsFor('owner');
    await handleUssdRequest(req('s3', ''), deps);
    await handleUssdRequest(req('s3', '1'), deps); // lease detail
    const res = await handleUssdRequest(req('s3', '1*0'), deps);
    expect(res.message).toContain('BossNyumba');
  });

  it('rejects an invalid main-menu choice without ending', async () => {
    const deps = depsFor('owner');
    await handleUssdRequest(req('s4', ''), deps);
    const res = await handleUssdRequest(req('s4', '9'), deps);
    expect(res.isEnd).toBe(false);
    expect(res.message).toContain('Invalid choice');
  });
});

describe('meter-reading flow', () => {
  it('walks amount -> confirm -> logged and records the reading', async () => {
    let recorded: number | null = null;
    const data = makeData({
      recordMeterReading: async (_session, units) => {
        recorded = units;
        return true;
      },
    });
    const deps = depsFor('tenant', data);
    await handleUssdRequest(req('s5', ''), deps);
    const prompt = await handleUssdRequest(req('s5', '3'), deps);
    expect(prompt.message).toContain('units');

    const confirm = await handleUssdRequest(req('s5', '3*45'), deps);
    expect(confirm.message).toContain('45u');

    const done = await handleUssdRequest(req('s5', '3*45*1'), deps);
    expect(done.isEnd).toBe(true);
    expect(done.message).toContain('submitted');
    expect(recorded).toBe(45);
  });

  it('rejects a non-numeric amount', async () => {
    const deps = depsFor('tenant');
    await handleUssdRequest(req('s6', ''), deps);
    await handleUssdRequest(req('s6', '3'), deps);
    const res = await handleUssdRequest(req('s6', '3*abc'), deps);
    expect(res.message).toContain('Invalid');
  });

  it('cancels on "2" at the confirm step', async () => {
    let recorded = false;
    const data = makeData({
      recordMeterReading: async () => {
        recorded = true;
        return true;
      },
    });
    const deps = depsFor('tenant', data);
    await handleUssdRequest(req('s7', ''), deps);
    await handleUssdRequest(req('s7', '3'), deps);
    await handleUssdRequest(req('s7', '3*45'), deps);
    const res = await handleUssdRequest(req('s7', '3*45*2'), deps);
    expect(res.message).toContain('BossNyumba');
    expect(recorded).toBe(false);
  });
});

describe('language switch (zero-mix)', () => {
  it('switches to Swahili and renders a Swahili-only menu thereafter', async () => {
    const deps = depsFor('owner');
    await handleUssdRequest(req('s8', ''), deps);
    const picker = await handleUssdRequest(req('s8', '#'), deps);
    expect(picker.message).toContain('English');
    expect(picker.message).toContain('Kiswahili');

    const set = await handleUssdRequest(req('s8', '#*2'), deps);
    expect(set.message).toContain('Kiswahili');

    // Subsequent navigation must render Swahili only (zero-mix persists).
    const lease = await handleUssdRequest(req('s8', '#*2*1'), deps);
    expect(lease.message).toContain('Mkataba Wangu');
    expect(lease.message).not.toContain('My Lease');
  });
});

describe('session expiry', () => {
  it('returns a timeout screen once the TTL elapses', async () => {
    const { clock, advance } = fixedClock();
    const deps = depsFor('owner', makeData(), clock);
    await handleUssdRequest(req('s9', ''), deps);
    advance(200_000); // > 180s TTL
    const res = await handleUssdRequest(req('s9', '1'), deps);
    expect(res.isEnd).toBe(true);
    expect(res.message).toContain('Session expired');
  });
});

describe('fail-soft', () => {
  it('renders a generic error when a data fetcher throws', async () => {
    const data = makeData({
      fetchRent: async () => {
        throw new Error('db down');
      },
    });
    const deps = depsFor('owner', data);
    await handleUssdRequest(req('s10', ''), deps);
    const res = await handleUssdRequest(req('s10', '2'), deps);
    expect(res.message).toContain('Something went wrong');
  });

  it('treats an identity-resolver throw as an anonymous caller', async () => {
    const deps: UssdEngineDeps = {
      store: createInMemorySessionStore(),
      identity: {
        resolve: async () => {
          throw new Error('directory unreachable');
        },
      },
      data: makeData(),
      defaultLanguage: 'en',
    };
    const res = await handleUssdRequest(req('s11', ''), deps);
    expect(res.message).toContain('Vacant Units');
    expect(res.message).not.toContain('Rent Due');
  });
});
