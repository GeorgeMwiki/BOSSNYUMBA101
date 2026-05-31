/**
 * useOwnerTabsStore — owner-portal dynamic tab strip state.
 *
 * Ported from Borjie's apps/owner-web/src/lib/owner-tabs-store.ts and
 * adapted to BossNyumba's real-estate tab kinds (rent / leases /
 * tenants / maintenance / compliance / finance / …).
 *
 * The owner cockpit is built around a tab strip the owner can spawn /
 * pin / close / reorder. The brain spawns tabs by emitting `<tab_spawn>`
 * / `<spawn_tabs>` inline-XML in chat replies; the gateway lifts those
 * tags out of the visible deltas (chat-tab-bridge) and re-emits them as
 * discrete SSE envelopes; the chat-ui hook routes them through
 * `handleTabSseFrame` from @bossnyumba/chat-ui into THIS store.
 *
 * Persistence:
 *   - `localStorage` is the offline cache (instant hydration on cold
 *     load + survives flaky network).
 *   - `GET/PUT/POST /api/v1/owner/tabs` is the durable cross-device
 *     source of truth (migration 0300, RLS-FORCE). Hydrate once on
 *     mount; debounced PUT on every mutation keeps the server snapshot
 *     in lockstep so the landlord roaming between phone and laptop
 *     sees the same spawned tabs.
 *
 * Phase 2 refinement — DEDUP + AUGMENT-IN-PLACE:
 *
 *   When the brain or owner asks for a tab type that already exists in
 *   the current strip, do NOT spawn a duplicate. Instead AUGMENT the
 *   existing tab in place:
 *
 *     - Merge new context fields into the open tab's `context` object.
 *       Conflicting scalars become arrays so augmentation never silently
 *       overwrites.
 *     - Bump `augmentedAt` so panels watching with `useTabAugmentation`
 *       can fade-in the new rows / fields without remount.
 *     - Increment `pendingUpdates` so the tab strip can render a "+N"
 *       badge on the pip while the owner is reading another tab.
 *
 * Public surface:
 *   - `useOwnerTabs()` hook returning the store API including the new
 *     `spawnOrAugment` and `acknowledgeAugmentation` methods.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { OwnerOSTabType } from '@bossnyumba/owner-os-tabs';

const STORAGE_KEY = 'bossnyumba:owner-tabs:v1';

// ─── Public types ───────────────────────────────────────────────────

export type OwnerTabKind = OwnerOSTabType;

export interface OwnerTab {
  /** Stable id. Deterministic by (kind, context) for dedup; literal for built-ins. */
  readonly id: string;
  /** Kind drives the panel renderer. */
  readonly kind: OwnerTabKind;
  /** Display label. */
  readonly title: string;
  /** Optional context payload. Conflicting scalars become arrays on augment. */
  readonly context?: Readonly<Record<string, unknown>>;
  /** Sticky / built-in tabs cannot be closed via the X button. */
  readonly pinned?: boolean;
  /** ISO 8601 — when the brain / owner last AUGMENTED this tab. */
  readonly augmentedAt?: string;
  /**
   * Count of unacknowledged augmentations since the owner last focused.
   * Renders as a "+N" badge on the tab pip in the strip.
   */
  readonly pendingUpdates?: number;
}

export interface OwnerTabsState {
  readonly tabs: ReadonlyArray<OwnerTab>;
  readonly activeTabId: string | null;
  readonly updatedAt: string;
}

const DEFAULT_STATE: OwnerTabsState = {
  tabs: [
    { id: 'chat', kind: 'chat', title: 'Chat', pinned: true },
  ],
  activeTabId: 'chat',
  updatedAt: new Date(0).toISOString(),
};

// ─── Context merge — conflicting scalars become arrays ──────────────

function unique<T>(arr: ReadonlyArray<T>): ReadonlyArray<T> {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const key = typeof v === 'string' ? v : JSON.stringify(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

function mergeContextValue(prev: unknown, next: unknown): unknown {
  if (prev === undefined || prev === null) return next;
  if (next === undefined || next === null) return prev;
  if (Array.isArray(prev) && Array.isArray(next)) return unique([...prev, ...next]);
  if (Array.isArray(prev)) return unique([...prev, next]);
  if (Array.isArray(next)) return unique([prev, ...next]);
  if (prev === next) return prev;
  if (typeof prev !== 'object' && typeof next !== 'object') {
    return unique([prev, next]);
  }
  if (typeof prev === 'object' && typeof next === 'object') {
    return { ...(prev as object), ...(next as object) };
  }
  return [prev, next];
}

export function mergeTabContext(
  prev: Readonly<Record<string, unknown>> | undefined,
  next: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  const a = prev ?? {};
  const b = next ?? {};
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = mergeContextValue(a[k], b[k]);
  }
  return out;
}

// ─── Deterministic id builder ───────────────────────────────────────
//
// Mirrors the server-side `deriveTabSpawnId` in
// services/api-gateway/src/lib/chat-tab-bridge.ts so both sides
// converge on the same id for the same (kind, scoping-context).

const BUILTIN_KINDS = new Set<OwnerTabKind>([
  'chat',
  'docs',
  'drafts',
  'reminders',
  'insights',
  'doc-context',
]);

const SCOPING_KEYS: ReadonlyArray<string> = [
  'propertyId',
  'leaseId',
  'tenantId',
  'employeeId',
  'counterpartyId',
  'documentId',
];

export function deterministicTabId(
  kind: OwnerTabKind,
  context: Readonly<Record<string, unknown>> | undefined,
): string {
  if (BUILTIN_KINDS.has(kind)) return kind;
  const ctx = context ?? {};
  const parts: string[] = [kind];
  for (const key of SCOPING_KEYS) {
    const v = ctx[key];
    if (typeof v === 'string' && v.length > 0) {
      parts.push(`${key}:${v}`);
    }
  }
  return parts.join('|');
}

// ─── Reducer — every mutation produces a NEW state object ───────────

type Action =
  | { type: 'hydrate'; state: OwnerTabsState }
  | { type: 'open'; tab: OwnerTab }
  | {
      type: 'spawn-or-augment';
      tab: OwnerTab;
      mergedTabId: string;
    }
  | { type: 'close'; tabId: string }
  | { type: 'focus'; tabId: string }
  | { type: 'rename'; tabId: string; title: string }
  | { type: 'acknowledge-augmentation'; tabId: string };

function reducer(state: OwnerTabsState, action: Action): OwnerTabsState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'open': {
      const exists = state.tabs.find((t) => t.id === action.tab.id);
      const tabs = exists ? state.tabs : [...state.tabs, action.tab];
      return {
        tabs,
        activeTabId: action.tab.id,
        updatedAt: new Date().toISOString(),
      };
    }
    case 'spawn-or-augment': {
      const now = new Date().toISOString();
      const existing = state.tabs.find((t) => t.id === action.mergedTabId);
      if (!existing) {
        return {
          tabs: [...state.tabs, action.tab],
          activeTabId: action.tab.id,
          updatedAt: now,
        };
      }
      // Augment in place — merge context, bump update counter.
      const merged: OwnerTab = {
        ...existing,
        context: mergeTabContext(existing.context, action.tab.context),
        augmentedAt: now,
        pendingUpdates:
          state.activeTabId === existing.id
            ? 0
            : (existing.pendingUpdates ?? 0) + 1,
      };
      const tabs = state.tabs.map((t) => (t.id === existing.id ? merged : t));
      return {
        tabs,
        // Keep current focus — augmentation should never yank the owner
        // out of what they were reading.
        activeTabId: state.activeTabId,
        updatedAt: now,
      };
    }
    case 'close': {
      const removed = state.tabs.find((t) => t.id === action.tabId);
      if (!removed || removed.pinned) return state;
      const tabs = state.tabs.filter((t) => t.id !== action.tabId);
      const nextActive =
        state.activeTabId === action.tabId
          ? tabs[0]?.id ?? null
          : state.activeTabId;
      return {
        tabs,
        activeTabId: nextActive,
        updatedAt: new Date().toISOString(),
      };
    }
    case 'focus': {
      if (!state.tabs.some((t) => t.id === action.tabId)) return state;
      const tabs = state.tabs.map((t) =>
        t.id === action.tabId && (t.pendingUpdates ?? 0) > 0
          ? { ...t, pendingUpdates: 0 }
          : t,
      );
      return {
        tabs,
        activeTabId: action.tabId,
        updatedAt: new Date().toISOString(),
      };
    }
    case 'rename':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, title: action.title } : t,
        ),
        updatedAt: new Date().toISOString(),
      };
    case 'acknowledge-augmentation':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, pendingUpdates: 0 } : t,
        ),
        updatedAt: new Date().toISOString(),
      };
    default:
      return state;
  }
}

// ─── localStorage helpers ───────────────────────────────────────────

function readLocal(): OwnerTabsState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OwnerTabsState;
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(state: OwnerTabsState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota or private-mode — silently drop, the in-memory state is fine.
  }
}

// ─── Public hook ────────────────────────────────────────────────────

export interface SpawnOrAugmentInput {
  /** The tab kind to ensure is present. */
  readonly kind: OwnerTabKind;
  /** Display label used when a fresh tab is spawned. */
  readonly title: string;
  /** Optional context. Merged into the existing tab on dedup. */
  readonly context?: Readonly<Record<string, unknown>>;
  /** Caller-supplied id override; defaults to deterministicTabId(...). */
  readonly explicitId?: string;
}

export interface SpawnOrAugmentResult {
  readonly tabId: string;
  readonly isNew: boolean;
}

export interface UseOwnerTabsApi {
  readonly tabs: ReadonlyArray<OwnerTab>;
  readonly activeTabId: string | null;
  readonly activeTab: OwnerTab | null;
  open(tab: OwnerTab): void;
  /**
   * Idempotent spawn — returns the existing tab id when one matches the
   * (kind, scoping-context) fingerprint, else opens a fresh tab.
   */
  spawnOrAugment(input: SpawnOrAugmentInput): SpawnOrAugmentResult;
  /** Clear the "+N" badge for a tab (called when its panel becomes visible). */
  acknowledgeAugmentation(tabId: string): void;
  close(tabId: string): void;
  focus(tabId: string): void;
  rename(tabId: string, title: string): void;
}

// Debounce window for server-side PUT sync. Mirrors Borjie's
// owner-tabs-store debounce so chains of rapid mutations (e.g. focus
// then close then open) coalesce to one network round-trip.
const SYNC_DEBOUNCE_MS = 800;

interface ServerHydrateResponse {
  readonly success?: boolean;
  readonly data?: {
    readonly state?: unknown;
    readonly updatedAt?: string | null;
    readonly hydratedFromDefault?: boolean;
  };
}

export function useOwnerTabs(): UseOwnerTabsApi {
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => readLocal() ?? DEFAULT_STATE,
  );
  const initial = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerSync = useRef<string | null>(null);

  // Hydrate from the server once on mount. If the server snapshot is
  // newer than localStorage we replace state; otherwise we keep the
  // local copy (and the next mutation will PUT it back to the server).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/owner/tabs', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (cancelled || !res.ok) return;
        const json = (await res.json()) as ServerHydrateResponse;
        const serverState = json?.data?.state as Partial<OwnerTabsState> | undefined;
        const serverUpdatedAt = json?.data?.updatedAt ?? null;
        if (!serverState || !Array.isArray(serverState.tabs)) return;
        const serverIso = serverUpdatedAt ?? new Date(0).toISOString();
        const localIso = stateRef.current.updatedAt;
        if (serverIso > localIso && serverState.tabs.length > 0) {
          dispatch({
            type: 'hydrate',
            state: {
              tabs: serverState.tabs as ReadonlyArray<OwnerTab>,
              activeTabId: serverState.activeTabId ?? null,
              updatedAt: serverIso,
            },
          });
          lastServerSync.current = serverIso;
        }
      } catch {
        // 401 / 503 / network — localStorage stays authoritative.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist + debounced server sync on every change.
  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    writeLocal(state);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void fetch('/api/v1/owner/tabs', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ state }),
      })
        .then((res) => {
          if (res.ok) lastServerSync.current = state.updatedAt;
        })
        .catch(() => {
          // Best-effort — localStorage is the offline cache.
        });
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [state]);

  const open = useCallback(
    (tab: OwnerTab) => dispatch({ type: 'open', tab }),
    [],
  );
  const close = useCallback(
    (tabId: string) => dispatch({ type: 'close', tabId }),
    [],
  );
  const focus = useCallback(
    (tabId: string) => dispatch({ type: 'focus', tabId }),
    [],
  );
  const rename = useCallback(
    (tabId: string, title: string) =>
      dispatch({ type: 'rename', tabId, title }),
    [],
  );
  const acknowledgeAugmentation = useCallback(
    (tabId: string) => dispatch({ type: 'acknowledge-augmentation', tabId }),
    [],
  );

  const spawnOrAugment = useCallback(
    (input: SpawnOrAugmentInput): SpawnOrAugmentResult => {
      const mergedTabId =
        input.explicitId ?? deterministicTabId(input.kind, input.context);
      const existing = stateRef.current.tabs.find((t) => t.id === mergedTabId);
      const isNew = !existing;
      const tab: OwnerTab = {
        id: mergedTabId,
        kind: input.kind,
        title: input.title,
        ...(input.context !== undefined && { context: input.context }),
      };
      dispatch({ type: 'spawn-or-augment', tab, mergedTabId });
      return { tabId: mergedTabId, isNew };
    },
    [],
  );

  const activeTab = useMemo(
    () => state.tabs.find((t) => t.id === state.activeTabId) ?? null,
    [state.tabs, state.activeTabId],
  );

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    activeTab,
    open,
    spawnOrAugment,
    acknowledgeAugmentation,
    close,
    focus,
    rename,
  };
}
