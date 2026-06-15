
/**
 * Tenant-currency resolution + currency-aware minor→major conversion for
 * owner-facing analytics / dashboard money renders.
 *
 * WHY THIS EXISTS
 * ---------------
 * The DB stores money as integer MINOR UNITS. The display layer must
 * divide by the currency's ISO-4217 minor-unit divisor — NOT a fixed
 * 100. The launch currency is TZS (and UGX) which are 0-decimal: their
 * minor unit IS the major unit, so the divisor is 1. A hardcoded `/ 100`
 * understates every TZS/UGX figure 100x (e.g. 5,000,000 TZS renders as
 * 50,000). See CLAUDE.md "Multi-currency · TZ at launch".
 *
 * The conversion delegates to the shared Money helper
 * (`Money.fromMinorUnits` + `toDecimal`), which reads the per-currency
 * divisor from the canonical ISO-4217 table in
 * `@bossnyumba/domain-models` — the exact pattern the C2B M-Pesa path
 * uses. There is therefore ONE currency-aware convention across the
 * codebase, reconciled with the identity `minorToMajor` in db-mappers.ts
 * (0-decimal ⇒ divide by 1).
 */

import { sql } from 'drizzle-orm';
import { Money, toDecimal, type CurrencyCode } from '@bossnyumba/domain-models';

/**
 * The first launch jurisdiction is Tanzania, so an unconfigured tenant
 * defaults to TZS (0-decimal). Never hard-code this in a render path —
 * it is a resolution fallback only.
 */
export const LAUNCH_CURRENCY: CurrencyCode = 'TZS';

/**
 * Resolve the tenant's display currency from `currency_preferences`.
 *
 * The table is keyed by (scope_kind, scope_id) — see
 * `packages/database/src/schemas/currency-preferences.schema.ts`. We read
 * the tenant tier first, then fall back to the platform-default tier, and
 * finally to the launch currency (TZS) so a render never throws on a
 * missing preference. The lookup is wrapped so a degraded DB cannot break
 * the surrounding dashboard query.
 */
export async function resolveTenantCurrency(
  db: { execute: (q: unknown) => Promise<unknown> },
  tenantId: string,
): Promise<CurrencyCode> {
  try {
    const result = (await db.execute(sql`
      SELECT currency
        FROM currency_preferences
       WHERE (scope_kind = 'tenant' AND scope_id = ${tenantId})
          OR (scope_kind = 'platform-default' AND scope_id = '*')
       ORDER BY CASE scope_kind WHEN 'tenant' THEN 0 ELSE 1 END
       LIMIT 1
    `)) as { rows?: ReadonlyArray<{ currency?: unknown }> };
    const currency = result.rows?.[0]?.currency;
    if (typeof currency === 'string' && currency.length >= 3) {
      return currency.toUpperCase();
    }
    return LAUNCH_CURRENCY;
  } catch {
    return LAUNCH_CURRENCY;
  }
}

/**
 * Build a currency-aware minor→major converter for a single render pass.
 * For 0-decimal currencies (TZS/UGX/RWF/JPY…) the divisor is 1; for
 * 2-decimal currencies it is 100; etc. — read from the ISO-4217 table
 * via the shared Money helper.
 *
 * @example
 *   const toMajor = minorToMajorFor('TZS');
 *   toMajor(5_000_000); // 5_000_000  (NOT 50_000)
 */
export function minorToMajorFor(
  currency: CurrencyCode,
): (minor: number | string | null | undefined) => number {
  return (minor) => {
    const n = Number(minor ?? 0);
    if (!Number.isFinite(n)) return 0;
    return toDecimal(Money.fromMinorUnits(Math.round(n), currency));
  };
}
