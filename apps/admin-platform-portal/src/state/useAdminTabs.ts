/**
 * useAdminTabs — admin-platform-portal dynamic tab strip state.
 *
 * Mirrors apps/owner-portal/src/state/useOwnerTabs.ts so HQ staff
 * spawn / pin / focus / close tabs the same way landlords do. The
 * brain spawns tabs by emitting `<tab_spawn>` / `<spawn_tabs>` inline-
 * XML in chat replies which the chat-tab-bridge routes here.
 *
 * Persistence:
 *   - `localStorage` is the offline cache.
 *   - `GET/PUT /api/v1/owner/tabs` is the durable per-user backing
 *     store (migration 0300, RLS-FORCE). The route is shared with the
 *     owner-portal — `tenant_id, user_id` already scopes the row, and
 *     HQ staff sit in a dedicated platform tenant.
 *
 * Real-estate vocabulary is wider than the owner-portal: HQ operators
 * pin platform tenants, support cases, audit traces, and risk
 * playbooks. The store treats `kind` as opaque text so new tab kinds
 * ship without a hook change.
 */

'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

const STORAGE_KEY = 'bossnyumba:admin-tabs:v1';
const SYNC_DEBOUNCE_MS = 800;

export interface AdminTab {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly pinned?: boolean;
  readonly augmentedAt?: string;
  readonly pendingUpdates?: number;
}

export interface AdminTabsState {
  readonly tabs: ReadonlyArray<AdminTab>;
  readonly activeTabId: string | null;
  readonly updatedAt: string;
}

const DEFAULT_STATE: AdminTabsState = Object.freeze({
  tabs: Object.freeze([
    { id: 'chat', kind: 'chat', title: 'Chat', pinned: true },
  ]),
  activeTabId: 'chat',
  updatedAt: new Date(0).toISOString(),
});

const SCOPING_KEYS = ['tenantId', 'caseId', 'traceId', 'playbookId'] as const;

function deterministicTabId(
  kind: string,
  context: Readonly<Record<string, unknown>> | undefined,
): string {
  if (!context || Object.keys(context).length === 0) return kind;
  const parts: string[] = [kind];
  for (const key of SCOPING_KEYS) {
    const v = context[key];
    if (typeof v === 'string' && v.length > 0) parts.push(`${key}:${v}`);
  }
  return parts.join('|');
}

// ─── Reducer ─────────────────────────────────────────────────────────

type Action =
  | { type: 'open'; tab: AdminTab }
  | { type: 'spawn-or-augment'; tab: AdminTab; mergedTabId: string }
  | { type: 'close'; tabId: string }
  | { type: 'focus'; tabId: string }
  | { type: 'rename'; tabId: string; title: string }
  | { type: 'acknowledge-augmentation'; tabId: string }
  | { type: 'hydrate'; state: AdminTabsState };

function reducer(state: AdminTabsState, action: Action): AdminTabsState {
  const nowIso = new Date().toISOString();
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'open': {
      const existing = state.tabs.find((t) => t.id === action.tab.id);
      if (existing) {
        return { ...state, activeTabId: action.tab.id, updatedAt: nowIso };
      }
      return {
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
        updatedAt: nowIso,
      };
    }
    case 'spawn-or-augment': {
      const existing = state.tabs.find((t) => t.id === action.mergedTabId);
      if (!existing) {
        return {
          tabs: [...state.tabs, action.tab],
          activeTabId: action.mergedTabId,
          updatedAt: nowIso,
        };
      }
      // Augment in place: merge context, bump pendingUpdates, keep
      // existing pin / focus state intact.
      const mergedContext: Record<string, unknown> = {
        ...(existing.context ?? {}),
        ...(action.tab.context ?? {}),
      };
      const augmented: AdminTab = {
        ...existing,
        context: mergedContext,
        augmentedAt: nowIso,
        pendingUpdates: (existing.pendingUpdates ?? 0) + 1,
      };
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === existing.id ? augmented : t,
        ),
        updatedAt: nowIso,
      };
    }
    case 'close': {
      const target = state.tabs.find((t) => t.id === action.tabId);
      if (!target || target.pinned) return state;
      const remaining = state.tabs.filter((t) => t.id !== action.tabId);
      const activeTabId =
        state.activeTabId === action.tabId
          ? (remaining[remaining.length - 1]?.id ?? null)
          : state.activeTabId;
      return { tabs: remaining, activeTabId, updatedAt: nowIso };
    }
    case 'focus':
      return { ...state, activeTabId: action.tabId, updatedAt: nowIso };
    case 'rename':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, title: action.title } : t,
        ),
        updatedAt: nowIso,
      };
    case 'acknowledge-augmentation':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, pendingUpdates: 0 } : t,
        ),
        updatedAt: nowIso,
      };
    default:
      return state;
  }
}

// ─── localStorage helpers ────────────────────────────────────────────

function readLocal(): AdminTabsState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminTabsState;
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(state: AdminTabsState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode — fine, in-memory copy survives this session.
  }
}

// ─── Public API ──────────────────────────────────────────────────────

export interface SpawnOrAugmentInput {
  readonly kind: string;
  readonly title: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly explicitId?: string;
}

export interface SpawnOrAugmentResult {
  readonly tabId: string;
  readonly isNew: boolean;
}

export interface UseAdminTabsApi {
  readonly tabs: ReadonlyArray<AdminTab>;
  readonly activeTabId: string | null;
  readonly activeTab: AdminTab | null;
  open(tab: AdminTab): void;
  spawnOrAugment(input: SpawnOrAugmentInput): SpawnOrAugmentResult;
  acknowledgeAugmentation(tabId: string): void;
  close(tabId: string): void;
  focus(tabId: string): void;
  rename(tabId: string, title: string): void;
}

interface ServerHydrateResponse {
  readonly success?: boolean;
  readonly data?: {
    readonly state?: unknown;
    readonly updatedAt?: string | null;
  };
}

export function useAdminTabs(): UseAdminTabsApi {
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => readLocal() ?? DEFAULT_STATE,
  );
  const initial = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from /api/v1/owner/tabs on mount. The route is shared
  // with the owner-portal — HQ staff sit in the platform tenant, so
  // the (tenant_id, user_id) PK keeps strips siloed.
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
        const serverState = json?.data?.state as Partial<AdminTabsState> | undefined;
        const serverUpdatedAt = json?.data?.updatedAt ?? null;
        if (!serverState || !Array.isArray(serverState.tabs)) return;
        const serverIso = serverUpdatedAt ?? new Date(0).toISOString();
        const localIso = stateRef.current.updatedAt;
        if (serverIso > localIso && serverState.tabs.length > 0) {
          dispatch({
            type: 'hydrate',
            state: {
              tabs: serverState.tabs as ReadonlyArray<AdminTab>,
              activeTabId: serverState.activeTabId ?? null,
              updatedAt: serverIso,
            },
          });
        }
      } catch {
        // 401 / 503 / network — localStorage stays authoritative.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist + debounced server sync on every mutation.
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
      }).catch(() => {
        // Best-effort — localStorage is the offline cache.
      });
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [state]);

  const open = useCallback((tab: AdminTab) => dispatch({ type: 'open', tab }), []);
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
      const tab: AdminTab = {
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
