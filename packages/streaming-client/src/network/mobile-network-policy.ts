/**
 * Phase J8 — MobileNetworkPolicy.
 *
 * Inspects the Network Information API (`navigator.connection`) and
 * computes the optimal:
 *   - token-batch interval (more batching on slow networks)
 *   - entity-pagination size (smaller pages on 2G)
 *   - transport preference (WS on wifi/4G, SSE on slower)
 *   - offline-degrade behaviour
 *
 * Thresholds are deliberately conservative — see the tuning table at
 * the bottom of this file. They were chosen to match Chrome devtools'
 * built-in "Slow 3G" preset (RTT 2000ms, downlink 50KB/s).
 *
 * The Network Information API is NOT universally supported (Safari +
 * Firefox don't ship it). The policy degrades to "best-known" defaults
 * (`4g`, no save-data) when the API is missing.
 */

import type { MobileNetworkSnapshot, MobileNetworkTuning, NetworkClass } from '../types.js';

interface NetworkInformationLike {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  addEventListener?(type: 'change', handler: () => void): void;
  removeEventListener?(type: 'change', handler: () => void): void;
}

interface NavigatorWithConnection {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
  onLine?: boolean;
}

export interface MobileNetworkPolicyDeps {
  /** Inject navigator for tests. Defaults to `globalThis.navigator`. */
  navigator?: NavigatorWithConnection;
  /**
   * Window event-target to listen on for `online`/`offline` events.
   * Tests pass in a stub `EventTarget`.
   */
  events?: {
    addEventListener(type: 'online' | 'offline', handler: () => void): void;
    removeEventListener(type: 'online' | 'offline', handler: () => void): void;
  };
}

// ─────────────────────────────────────────────────────────────────────
// Tuning table — exported so the bench / tests can assert against it.
// ─────────────────────────────────────────────────────────────────────

export const NETWORK_TUNING: Record<NetworkClass, MobileNetworkTuning> = {
  wifi: {
    tokenBatchMs: 50,
    entityPageSize: 100,
    streamBufferMs: 50,
    offlineDegrade: 'show-banner',
  },
  '4g': {
    tokenBatchMs: 50,
    entityPageSize: 100,
    streamBufferMs: 100,
    offlineDegrade: 'show-banner',
  },
  '3g': {
    tokenBatchMs: 250,
    entityPageSize: 50,
    streamBufferMs: 500,
    offlineDegrade: 'cache-only',
  },
  '2g': {
    tokenBatchMs: 1000,
    entityPageSize: 20,
    streamBufferMs: 1500,
    offlineDegrade: 'cache-only',
  },
  'slow-2g': {
    tokenBatchMs: 1000,
    entityPageSize: 20,
    streamBufferMs: 3000,
    offlineDegrade: 'queue-writes',
  },
  offline: {
    tokenBatchMs: 1000,
    entityPageSize: 20,
    streamBufferMs: 3000,
    offlineDegrade: 'queue-writes',
  },
};

/**
 * Classify a raw effectiveType + saveData hint into a known class.
 * Anything we don't recognise falls back to '4g' (the WHATWG default
 * for `effectiveType` when the UA wants to be opaque).
 */
export function classifyNetwork(snapshot: Omit<MobileNetworkSnapshot, 'class'>): NetworkClass {
  if (snapshot.offline) return 'offline';
  if (snapshot.saveData && (snapshot.rttMs ?? 0) > 1000) return 'slow-2g';
  if (snapshot.rttMs !== null) {
    if (snapshot.rttMs >= 2000) return 'slow-2g';
    if (snapshot.rttMs >= 1000) return '2g';
    if (snapshot.rttMs >= 400) return '3g';
  }
  if (snapshot.downlinkMbps !== null) {
    if (snapshot.downlinkMbps < 0.1) return 'slow-2g';
    if (snapshot.downlinkMbps < 0.25) return '2g';
    if (snapshot.downlinkMbps < 1.5) return '3g';
  }
  return '4g';
}

export class MobileNetworkPolicy {
  private readonly nav: NavigatorWithConnection;
  private readonly events: NonNullable<MobileNetworkPolicyDeps['events']>;
  private snapshot: MobileNetworkSnapshot;
  private readonly listeners = new Set<(snap: MobileNetworkSnapshot) => void>();
  private readonly connectionChangeHandler = () => this.refresh();
  private readonly onlineHandler = () => this.refresh();
  private readonly offlineHandler = () => this.refresh();

  constructor(deps: MobileNetworkPolicyDeps = {}) {
    this.nav = deps.navigator ?? ((globalThis as unknown as { navigator?: NavigatorWithConnection }).navigator ?? {});
    this.events = deps.events ?? {
      addEventListener: (type, handler) => {
        const target = globalThis as unknown as { addEventListener?: typeof globalThis.addEventListener };
        target.addEventListener?.(type, handler as EventListener);
      },
      removeEventListener: (type, handler) => {
        const target = globalThis as unknown as { removeEventListener?: typeof globalThis.removeEventListener };
        target.removeEventListener?.(type, handler as EventListener);
      },
    };
    this.snapshot = this.read();
    this.attach();
  }

  /** Detach all listeners — call in component unmount. */
  destroy(): void {
    const conn = this.getConnection();
    if (conn?.removeEventListener) {
      conn.removeEventListener('change', this.connectionChangeHandler);
    }
    this.events.removeEventListener('online', this.onlineHandler);
    this.events.removeEventListener('offline', this.offlineHandler);
    this.listeners.clear();
  }

  getSnapshot(): MobileNetworkSnapshot {
    return this.snapshot;
  }

  getTuning(): MobileNetworkTuning {
    return NETWORK_TUNING[this.snapshot.class];
  }

  /**
   * Subscribe to network-class changes. The listener is also invoked
   * synchronously with the current snapshot so the consumer can wire
   * up initial state in one step.
   */
  subscribe(listener: (snap: MobileNetworkSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  /** Force a re-read — exposed for the bench harness. */
  refresh(): MobileNetworkSnapshot {
    const next = this.read();
    if (
      next.class === this.snapshot.class &&
      next.offline === this.snapshot.offline &&
      next.saveData === this.snapshot.saveData
    ) {
      return this.snapshot;
    }
    this.snapshot = next;
    for (const listener of this.listeners) {
      try {
        listener(next);
      } catch {
        // Listener isolation.
      }
    }
    return this.snapshot;
  }

  private attach(): void {
    const conn = this.getConnection();
    if (conn?.addEventListener) {
      conn.addEventListener('change', this.connectionChangeHandler);
    }
    this.events.addEventListener('online', this.onlineHandler);
    this.events.addEventListener('offline', this.offlineHandler);
  }

  private getConnection(): NetworkInformationLike | undefined {
    return this.nav.connection ?? this.nav.mozConnection ?? this.nav.webkitConnection;
  }

  private read(): MobileNetworkSnapshot {
    const offline = this.nav.onLine === false;
    const conn = this.getConnection();
    const base: Omit<MobileNetworkSnapshot, 'class'> = {
      rttMs: typeof conn?.rtt === 'number' ? conn.rtt : null,
      downlinkMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
      saveData: conn?.saveData === true,
      offline,
    };
    // Use the UA's `effectiveType` if it gives us one of our classes
    // directly — otherwise fall through to `classifyNetwork`.
    const explicit = conn?.effectiveType;
    let cls: NetworkClass;
    if (offline) cls = 'offline';
    else if (explicit === 'slow-2g' || explicit === '2g' || explicit === '3g' || explicit === '4g') {
      cls = explicit;
    } else {
      cls = classifyNetwork(base);
    }
    return { ...base, class: cls };
  }
}
