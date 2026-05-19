/**
 * Phase J8 — OptimisticStateReducer.
 *
 * Redux-style accumulating reducer for token-by-token chat streams.
 * Maintains a chat-message store that the UI subscribes to. Every
 * `ChatStreamEvent` is folded into an immutable next state by the pure
 * `applyEvent` step (in `./apply-event.ts`).
 *
 * Why a hand-rolled reducer instead of redux/zustand:
 * - Keeps the package zero-dep at runtime (the portal layer chooses its
 *   state library; we just expose `getState()` + `subscribe()`).
 * - The reducer is pure → trivially benchmarkable + fork-safe.
 *
 * CRITICAL: never mutate state — see ~/.claude/rules/coding-style.md.
 */

import type { ChatStreamEvent, OptimisticChatState, ProactiveRecommendation } from '../types.js';
import { applyEvent, EMPTY_STATE } from './apply-event.js';

export interface OptimisticStateReducerDeps {
  /** Initial state — defaults to an empty thread. */
  initialState?: OptimisticChatState;
  /** Clock injected for deterministic tests. */
  now?: () => number;
  /**
   * Token-batch interval in ms. Set by `MobileNetworkPolicy` — on slow
   * networks we accumulate tokens for longer before notifying listeners,
   * saving battery + paint cost. Zero = no batching.
   */
  tokenBatchMs?: number;
  /** Test hook so we can fast-forward the batch window. */
  scheduleFlush?: (fn: () => void, ms: number) => unknown;
  /** Cancel handle for the test hook. */
  cancelFlush?: (handle: unknown) => void;
}

export class OptimisticStateReducer {
  private state: OptimisticChatState;
  private readonly listeners = new Set<(state: OptimisticChatState) => void>();
  private readonly now: () => number;
  private readonly batchMs: number;
  private readonly scheduleFlush: (fn: () => void, ms: number) => unknown;
  private readonly cancelFlush: (handle: unknown) => void;
  private pendingFlush: unknown = null;
  /** Counters for benchmarks / observability. */
  private readonly counters = { eventsApplied: 0, flushes: 0 };

  constructor(deps: OptimisticStateReducerDeps = {}) {
    this.state = deps.initialState ?? EMPTY_STATE;
    this.now = deps.now ?? (() => Date.now());
    this.batchMs = Math.max(0, deps.tokenBatchMs ?? 0);
    this.scheduleFlush = deps.scheduleFlush ?? ((fn, ms) => setTimeout(fn, ms));
    this.cancelFlush =
      deps.cancelFlush ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  getState(): OptimisticChatState {
    return this.state;
  }

  /**
   * Subscribe to state changes. Returns an unsubscribe function so
   * `useEffect` cleanup is one-liner.
   */
  subscribe(listener: (state: OptimisticChatState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Manually inject a recommendation (e.g. from a push that arrived
   * while the tab was backgrounded).
   */
  injectRecommendation(rec: ProactiveRecommendation): void {
    if (this.state.recommendations.some((r) => r.id === rec.id)) return;
    this.state = { ...this.state, recommendations: [...this.state.recommendations, rec] };
    this.notify();
  }

  /** Reset to empty — called on tenant-switch + sign-out. */
  reset(initial?: OptimisticChatState): void {
    if (this.pendingFlush) {
      this.cancelFlush(this.pendingFlush);
      this.pendingFlush = null;
    }
    this.state = initial ?? EMPTY_STATE;
    this.notify();
  }

  /** Read-only counters — used by the mobile-bench to measure overhead. */
  getCounters(): { eventsApplied: number; flushes: number } {
    return { ...this.counters };
  }

  /** Apply an event from a transport. Honours the batch window. */
  apply(event: ChatStreamEvent): void {
    const next = applyEvent(this.state, event, this.now());
    if (next === this.state) return;
    this.state = next;
    this.counters.eventsApplied += 1;

    // Non-token events flush immediately so the UI never feels stuck
    // on a tool-call or terminal event.
    const isToken = event.type === 'TEXT_MESSAGE_CONTENT';
    if (!isToken || this.batchMs === 0) {
      this.flush();
      return;
    }
    if (this.pendingFlush !== null) return;
    this.pendingFlush = this.scheduleFlush(() => {
      this.pendingFlush = null;
      this.flush();
    }, this.batchMs);
  }

  private flush(): void {
    this.counters.flushes += 1;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Listener isolation — never block the reducer.
      }
    }
  }
}

// Re-export the pure step so callers can use it without instantiating
// the class (e.g. server-side replay tests, snapshot diffing).
export { applyEvent } from './apply-event.js';
