/**
 * Phase J8 — MobileNetworkPolicy tests.
 */

import { describe, expect, it } from 'vitest';
import { MobileNetworkPolicy, NETWORK_TUNING, classifyNetwork } from './mobile-network-policy.js';

interface FakeNav {
  connection?: {
    effectiveType?: string;
    rtt?: number;
    downlink?: number;
    saveData?: boolean;
    addEventListener?(type: 'change', handler: () => void): void;
    removeEventListener?(type: 'change', handler: () => void): void;
  };
  onLine?: boolean;
}

function fakeEvents() {
  const handlers = new Map<string, Set<() => void>>();
  return {
    handlers,
    addEventListener(type: 'online' | 'offline', handler: () => void) {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      set.add(handler);
    },
    removeEventListener(type: 'online' | 'offline', handler: () => void) {
      handlers.get(type)?.delete(handler);
    },
    fire(type: 'online' | 'offline') {
      for (const h of handlers.get(type) ?? []) h();
    },
  };
}

describe('classifyNetwork', () => {
  it('returns offline when offline flag set', () => {
    expect(classifyNetwork({ rttMs: null, downlinkMbps: null, saveData: false, offline: true })).toBe('offline');
  });

  it('uses RTT thresholds when present', () => {
    expect(classifyNetwork({ rttMs: 100, downlinkMbps: null, saveData: false, offline: false })).toBe('4g');
    expect(classifyNetwork({ rttMs: 500, downlinkMbps: null, saveData: false, offline: false })).toBe('3g');
    expect(classifyNetwork({ rttMs: 1500, downlinkMbps: null, saveData: false, offline: false })).toBe('2g');
    expect(classifyNetwork({ rttMs: 3000, downlinkMbps: null, saveData: false, offline: false })).toBe('slow-2g');
  });

  it('uses downlink thresholds when RTT is missing', () => {
    expect(classifyNetwork({ rttMs: null, downlinkMbps: 10, saveData: false, offline: false })).toBe('4g');
    expect(classifyNetwork({ rttMs: null, downlinkMbps: 0.5, saveData: false, offline: false })).toBe('3g');
    expect(classifyNetwork({ rttMs: null, downlinkMbps: 0.15, saveData: false, offline: false })).toBe('2g');
    expect(classifyNetwork({ rttMs: null, downlinkMbps: 0.05, saveData: false, offline: false })).toBe('slow-2g');
  });

  it('defaults to 4g when no hints are available', () => {
    expect(classifyNetwork({ rttMs: null, downlinkMbps: null, saveData: false, offline: false })).toBe('4g');
  });
});

describe('NETWORK_TUNING', () => {
  it('uses 50ms batching on wifi and 4g', () => {
    expect(NETWORK_TUNING.wifi.tokenBatchMs).toBe(50);
    expect(NETWORK_TUNING['4g'].tokenBatchMs).toBe(50);
  });
  it('escalates batching to 250ms on 3g', () => {
    expect(NETWORK_TUNING['3g'].tokenBatchMs).toBe(250);
  });
  it('escalates batching to 1s on 2g + slow-2g', () => {
    expect(NETWORK_TUNING['2g'].tokenBatchMs).toBe(1000);
    expect(NETWORK_TUNING['slow-2g'].tokenBatchMs).toBe(1000);
  });
  it('shrinks pagination on slow networks', () => {
    expect(NETWORK_TUNING.wifi.entityPageSize).toBe(100);
    expect(NETWORK_TUNING['3g'].entityPageSize).toBe(50);
    expect(NETWORK_TUNING['2g'].entityPageSize).toBe(20);
  });
  it('grows the streaming buffer as the connection slows', () => {
    expect(NETWORK_TUNING.wifi.streamBufferMs).toBe(50);
    expect(NETWORK_TUNING['4g'].streamBufferMs).toBe(100);
    expect(NETWORK_TUNING['3g'].streamBufferMs).toBe(500);
    expect(NETWORK_TUNING['2g'].streamBufferMs).toBe(1500);
    expect(NETWORK_TUNING['slow-2g'].streamBufferMs).toBe(3000);
    expect(NETWORK_TUNING.offline.streamBufferMs).toBe(3000);
  });
});

describe('MobileNetworkPolicy', () => {
  it('reads NetInfo effectiveType when present', () => {
    const nav: FakeNav = { onLine: true, connection: { effectiveType: '3g', rtt: 500, downlink: 1, saveData: false } };
    const events = fakeEvents();
    const policy = new MobileNetworkPolicy({ navigator: nav as unknown as Navigator, events });
    expect(policy.getSnapshot().class).toBe('3g');
    expect(policy.getTuning().tokenBatchMs).toBe(250);
    policy.destroy();
  });

  it('returns offline when navigator.onLine is false', () => {
    const nav: FakeNav = { onLine: false, connection: { effectiveType: '4g' } };
    const events = fakeEvents();
    const policy = new MobileNetworkPolicy({ navigator: nav as unknown as Navigator, events });
    expect(policy.getSnapshot().class).toBe('offline');
    policy.destroy();
  });

  it('fires the subscriber synchronously with the initial snapshot', () => {
    const events = fakeEvents();
    const policy = new MobileNetworkPolicy({
      navigator: { onLine: true, connection: { effectiveType: '4g' } } as unknown as Navigator,
      events,
    });
    let seen = 0;
    policy.subscribe(() => {
      seen += 1;
    });
    expect(seen).toBe(1);
    policy.destroy();
  });

  it('reacts to offline events', () => {
    let online = true;
    const nav: FakeNav = {
      get onLine() {
        return online;
      },
    } as FakeNav;
    const events = fakeEvents();
    const policy = new MobileNetworkPolicy({ navigator: nav as unknown as Navigator, events });
    expect(policy.getSnapshot().class).toBe('4g');
    online = false;
    events.fire('offline');
    expect(policy.getSnapshot().class).toBe('offline');
    policy.destroy();
  });

  it('falls back to safe defaults when navigator.connection is missing', () => {
    const events = fakeEvents();
    const policy = new MobileNetworkPolicy({ navigator: { onLine: true } as unknown as Navigator, events });
    expect(policy.getSnapshot().class).toBe('4g');
    policy.destroy();
  });
});
