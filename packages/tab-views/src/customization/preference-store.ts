/**
 * CustomizationStore — persistence port for `ViewPreference` entities.
 *
 * The vision: when the owner customises a view (reorders columns,
 * adds a sort, filters out a category), the MD stores the
 * preference as a `view_preference` entity in J1. The next time
 * the owner asks the same question, the MD recalls the preference
 * + threads it through `RenderContext.preference` so the renderer
 * serves the pre-customised view.
 *
 * Scope semantics:
 *   - `session`       Bound to a sessionId. Wiped on session end.
 *   - `conversation`  Bound to a conversationId. Persists for the thread.
 *   - `tenant`        Bound to a tenantId. Persists forever.
 *
 * Each scope has its own key namespace inside the store. A
 * tenant-scope preference never bleeds into a conversation lookup
 * — the MD has to explicitly ask for the tenant scope to get
 * tenant prefs.
 *
 * Lookup precedence (the typical MD pattern):
 *   1. Look up the conversation-scope preference first.
 *   2. Fall back to the tenant-scope preference if the conversation
 *      didn't have one.
 *   3. Fall back to no preference (default view).
 * The store exposes `readResolved(scopes...)` for this pattern.
 *
 * Identity:
 *   Preferences are identified by (viewKey, scope, scopeKey). A
 *   tenant-scope preference is keyed by `tenantId`. A
 *   conversation-scope preference is keyed by `conversationId`.
 *   A session-scope preference is keyed by `sessionId`.
 */

import type {
  ViewPreference,
  PreferenceScope,
} from '../types/tab-view.js';
import type { Principal } from '../types/principal.js';

export interface ReadPreferenceArgs {
  readonly principal: Principal;
  readonly viewKey: string;
  readonly scope: PreferenceScope;
  readonly conversationId?: string;
  readonly sessionId?: string;
}

export interface WritePreferenceArgs {
  readonly principal: Principal;
  /** May omit `id` + `updatedAt`; store stamps them. */
  readonly preference: Omit<ViewPreference, 'id' | 'updatedAt'> & {
    readonly id?: string;
    readonly updatedAt?: string;
  };
  readonly conversationId?: string;
  readonly sessionId?: string;
}

export interface DeletePreferenceArgs {
  readonly principal: Principal;
  readonly viewKey: string;
  readonly scope: PreferenceScope;
  readonly conversationId?: string;
  readonly sessionId?: string;
}

export interface ReadResolvedArgs {
  readonly principal: Principal;
  readonly viewKey: string;
  readonly conversationId?: string;
  readonly sessionId?: string;
  /** Defaults to ['conversation', 'tenant']. */
  readonly scopes?: readonly PreferenceScope[];
}

export interface CustomizationStore {
  read(args: ReadPreferenceArgs): Promise<ViewPreference | undefined>;
  /**
   * Resolve the FIRST preference found across the supplied scopes,
   * in order. Default order: conversation → tenant.
   */
  readResolved(args: ReadResolvedArgs): Promise<ViewPreference | undefined>;
  write(args: WritePreferenceArgs): Promise<ViewPreference>;
  delete(args: DeletePreferenceArgs): Promise<void>;
}

/**
 * Build the lookup key for a preference. Returns `undefined` when
 * the scope-key is missing (e.g. session scope with no sessionId)
 * — the store treats that as "no preference exists".
 */
export function buildPreferenceKey(args: {
  principal: Principal;
  viewKey: string;
  scope: PreferenceScope;
  conversationId?: string;
  sessionId?: string;
}): string | undefined {
  switch (args.scope) {
    case 'tenant':
      return `pref::tenant::${args.principal.tenantId}::${args.viewKey}`;
    case 'conversation':
      if (!args.conversationId) return undefined;
      return `pref::conv::${args.principal.tenantId}::${args.conversationId}::${args.viewKey}`;
    case 'session':
      if (!args.sessionId) return undefined;
      return `pref::sess::${args.principal.tenantId}::${args.sessionId}::${args.viewKey}`;
    default: {
      const _x: never = args.scope;
      void _x;
      return undefined;
    }
  }
}

/**
 * In-memory store — used for tests + as a fallback when no J1-backed
 * store is wired. The map is exposed via `entries()` for inspection.
 *
 * The in-memory store implements the full contract including
 * cross-tenant isolation: keys are namespaced by tenantId, so two
 * principals on different tenants cannot read each other's prefs.
 */
export interface InMemoryCustomizationStore extends CustomizationStore {
  entries(): ReadonlyMap<string, ViewPreference>;
  clear(): void;
}

let _preferenceCounter = 0;
function nextPreferenceId(scope: PreferenceScope): string {
  _preferenceCounter = (_preferenceCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `pref-${scope}-${_preferenceCounter.toString(36)}-${Date.now().toString(36)}`;
}

export function createInMemoryCustomizationStore(): InMemoryCustomizationStore {
  const map = new Map<string, ViewPreference>();
  return {
    async read(args: ReadPreferenceArgs): Promise<ViewPreference | undefined> {
      const key = buildPreferenceKey(args);
      if (!key) return undefined;
      return map.get(key);
    },
    async readResolved(
      args: ReadResolvedArgs,
    ): Promise<ViewPreference | undefined> {
      const scopes = args.scopes ?? (['conversation', 'tenant'] as const);
      for (const s of scopes) {
        const baseArgs: ReadPreferenceArgs = {
          principal: args.principal,
          viewKey: args.viewKey,
          scope: s,
          ...(args.conversationId !== undefined
            ? { conversationId: args.conversationId }
            : {}),
          ...(args.sessionId !== undefined ? { sessionId: args.sessionId } : {}),
        };
        const found = await this.read(baseArgs);
        if (found !== undefined) return found;
      }
      return undefined;
    },
    async write(args: WritePreferenceArgs): Promise<ViewPreference> {
      const key = buildPreferenceKey({
        principal: args.principal,
        viewKey: args.preference.viewKey,
        scope: args.preference.scope,
        ...(args.conversationId !== undefined
          ? { conversationId: args.conversationId }
          : {}),
        ...(args.sessionId !== undefined ? { sessionId: args.sessionId } : {}),
      });
      if (!key) {
        throw new Error(
          `tab-views: cannot write ${args.preference.scope}-scope preference ` +
            'without the corresponding scope id (conversationId / sessionId).',
        );
      }
      const id = args.preference.id ?? nextPreferenceId(args.preference.scope);
      const updatedAt = args.preference.updatedAt ?? new Date().toISOString();
      const next: ViewPreference = {
        ...args.preference,
        id,
        updatedAt,
      };
      map.set(key, next);
      return next;
    },
    async delete(args: DeletePreferenceArgs): Promise<void> {
      const key = buildPreferenceKey(args);
      if (!key) return;
      map.delete(key);
    },
    entries(): ReadonlyMap<string, ViewPreference> {
      return map;
    },
    clear(): void {
      map.clear();
    },
  };
}
