/**
 * Currency-preferences service — resolves the display currency for a
 * given (tenantId, userId) request, with the resolution chain:
 *
 *     user override → tenant default → platform-default (seeded by 0119)
 *
 * The platform-default row is seeded by migration 0119; an operator
 * may rotate it via `upsert({ scopeKind: 'platform-default',
 * scopeId: '*', currency: 'TZS', source: 'admin-set' })` without a
 * code change. ISO-4217 codes are stored uppercase.
 *
 * AM-4 hardcoded-fallback-purge note: the `EMERGENCY_DISPLAY_FALLBACK_CURRENCY`
 * literal exists as a defence-in-depth fallback for the case where the
 * platform-default seed row is missing AND a DB error prevents reading
 * it. Both conditions are anomalous. The fallback now ships with a
 * caller-suppliable `onFallback` observer so the api-gateway can wire a
 * metric counter + warn log; if you see the counter increment in prod
 * the seed row is gone or DB is broken — neither is a normal state.
 *
 * The resolver short-circuits as soon as it finds a row in the chain.
 * On hard DB error the service returns the emergency fallback rather
 * than throwing — currency is a display concern, never worth crashing
 * a request over.
 */

import { and, eq, or, type SQL } from 'drizzle-orm';
import { currencyPreferences } from '../schemas/currency-preferences.schema.js';
import type { DatabaseClient } from '../client.js';

export type CurrencyPreferenceScopeKind =
  | 'user'
  | 'tenant'
  | 'platform-default';

export interface CurrencyPreferenceRow {
  readonly scopeKind: CurrencyPreferenceScopeKind;
  readonly scopeId: string;
  readonly currency: string;       // ISO-4217 uppercase
  readonly source: string | null;  // 'self-selected' | 'admin-set' | 'seed' | null
  readonly updatedAt: string;
}

export interface ResolvePreferenceArgs {
  readonly userId?: string | null;
  readonly tenantId?: string | null;
}

export interface ResolvedCurrency {
  readonly currency: string;       // ISO-4217 uppercase
  readonly source: 'user' | 'tenant' | 'platform-default' | 'fallback';
}

export interface CurrencyPreferencesService {
  /** Highest-priority preference for the request, with fallback. */
  resolve(args: ResolvePreferenceArgs): Promise<ResolvedCurrency>;
  /** All preference rows for diagnostic UIs. */
  list(filter?: { scopeKind?: CurrencyPreferenceScopeKind }): Promise<ReadonlyArray<CurrencyPreferenceRow>>;
  /** Insert or update a preference row. */
  upsert(record: Omit<CurrencyPreferenceRow, 'updatedAt'>): Promise<void>;
  /** Delete a preference row (e.g. user revokes their override). */
  remove(scopeKind: CurrencyPreferenceScopeKind, scopeId: string): Promise<void>;
}

/**
 * The defence-in-depth fallback when the platform-default seed row is
 * gone AND a DB error masks reading it. If this fires in production the
 * `onFallback` hook will surface it to observability — see the doc-
 * comment at the top of the file.
 */
const EMERGENCY_DISPLAY_FALLBACK_CURRENCY = 'USD';

/** The platform-default row's scope_id. */
const PLATFORM_DEFAULT_KEY = '*';

/**
 * Observer fired whenever the resolver returns the emergency fallback
 * instead of a real preference row. Wire to a counter + warn log in the
 * api-gateway composition root. Optional; if undefined the service stays
 * silent (unit tests don't need to wire this).
 */
export interface CurrencyPreferencesServiceOptions {
  readonly onFallback?: (reason: 'seed-missing' | 'db-error', detail?: unknown) => void;
}

export function createCurrencyPreferencesService(
  db: DatabaseClient,
  options: CurrencyPreferencesServiceOptions = {},
): CurrencyPreferencesService {
  return {
    async resolve(args) {
      // Build a single query for whichever scopes are reachable; pick
      // the highest-priority match in JS. One round-trip beats three.
      const userKey = args.userId ?? null;
      const tenantKey = args.tenantId ?? null;
      const candidates: Array<{ scopeKind: CurrencyPreferenceScopeKind; scopeId: string }> = [];
      if (userKey)   candidates.push({ scopeKind: 'user',             scopeId: userKey });
      if (tenantKey) candidates.push({ scopeKind: 'tenant',           scopeId: tenantKey });
      candidates.push(  { scopeKind: 'platform-default', scopeId: PLATFORM_DEFAULT_KEY });

      try {
        const conditions = candidates.map(
          (c) =>
            and(
              eq(currencyPreferences.scopeKind, c.scopeKind),
              eq(currencyPreferences.scopeId, c.scopeId),
            ) as SQL<unknown>,
        );
        const where: SQL<unknown> | undefined =
          conditions.length === 0
            ? undefined
            : conditions.length === 1
            ? conditions[0]
            : (or(...conditions) as SQL<unknown>);
        const rows = where
          ? await db.select().from(currencyPreferences).where(where)
          : await db.select().from(currencyPreferences);

        if (userKey) {
          const r = rows.find(
            (x) => x.scopeKind === 'user' && x.scopeId === userKey,
          );
          if (r) return { currency: normaliseCurrency(r.currency), source: 'user' };
        }
        if (tenantKey) {
          const r = rows.find(
            (x) => x.scopeKind === 'tenant' && x.scopeId === tenantKey,
          );
          if (r) return { currency: normaliseCurrency(r.currency), source: 'tenant' };
        }
        const platform = rows.find(
          (x) => x.scopeKind === 'platform-default' && x.scopeId === PLATFORM_DEFAULT_KEY,
        );
        if (platform) {
          return {
            currency: normaliseCurrency(platform.currency),
            source: 'platform-default',
          };
        }
        options.onFallback?.('seed-missing');
        return { currency: EMERGENCY_DISPLAY_FALLBACK_CURRENCY, source: 'fallback' };
      } catch (err) {
        // Currency is a display concern — don't crash the request, but
        // surface the fact via the observer so ops sees this anomaly.
        options.onFallback?.('db-error', err);
        return { currency: EMERGENCY_DISPLAY_FALLBACK_CURRENCY, source: 'fallback' };
      }
    },

    async list(filter) {
      const where = filter?.scopeKind
        ? eq(currencyPreferences.scopeKind, filter.scopeKind)
        : undefined;
      const rows = where
        ? await db.select().from(currencyPreferences).where(where)
        : await db.select().from(currencyPreferences);
      return rows.map(rowToShape);
    },

    async upsert(record) {
      await db
        .insert(currencyPreferences)
        .values({
          scopeKind: record.scopeKind,
          scopeId: record.scopeId,
          currency: normaliseCurrency(record.currency),
          source: record.source ?? null,
          updatedAt: new Date(),
        } as never)
        .onConflictDoUpdate({
          target: [currencyPreferences.scopeKind, currencyPreferences.scopeId],
          set: {
            currency: normaliseCurrency(record.currency),
            source: record.source ?? null,
            updatedAt: new Date(),
          } as never,
        });
    },

    async remove(scopeKind, scopeId) {
      await db
        .delete(currencyPreferences)
        .where(
          and(
            eq(currencyPreferences.scopeKind, scopeKind),
            eq(currencyPreferences.scopeId, scopeId),
          ),
        );
    },
  };
}

function rowToShape(r: typeof currencyPreferences.$inferSelect): CurrencyPreferenceRow {
  return {
    scopeKind: r.scopeKind as CurrencyPreferenceScopeKind,
    scopeId: r.scopeId,
    currency: normaliseCurrency(r.currency),
    source: r.source ?? null,
    updatedAt:
      r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

function normaliseCurrency(code: string): string {
  return code.trim().toUpperCase();
}

