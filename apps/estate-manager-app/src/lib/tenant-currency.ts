/**
 * Tenant-currency resolution for the estate-manager-app.
 *
 * The mobile/web app reads `NEXT_PUBLIC_TENANT_CURRENCY` at build time
 * (set per-tenant deploy). When the env var is absent we fall through
 * to the explicit `EMERGENCY_DISPLAY_FALLBACK_CURRENCY` literal — this
 * is the same defence-in-depth pattern as the customer-app's
 * `useCurrencyPreference` hook (AM-4 hardcoded-fallback-purge).
 *
 * If you see the emergency fallback fire in production it means the
 * deploy script forgot to set NEXT_PUBLIC_TENANT_CURRENCY — fix the
 * deploy, not this constant.
 */

/**
 * Last-resort display fallback when the per-tenant env var is absent.
 * Intentionally USD (the most-recognisable global currency) so the UI
 * keeps rendering rather than crashing. Real values come from the
 * `NEXT_PUBLIC_TENANT_CURRENCY` env var at build time.
 */
export const EMERGENCY_DISPLAY_FALLBACK_CURRENCY = 'USD';

let _warnedMissingEnv = false;

/**
 * Resolve the tenant currency for this app instance. Uses the build-
 * time env var and falls through to the emergency literal when absent.
 * The first non-resolution emits a one-shot dev warning.
 */
export function resolveTenantCurrency(): string {
  const fromEnv = process.env.NEXT_PUBLIC_TENANT_CURRENCY?.trim();
  if (fromEnv && fromEnv.length === 3) return fromEnv.toUpperCase();
  if (!_warnedMissingEnv && process.env.NODE_ENV !== 'production') {
    _warnedMissingEnv = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[estate-manager-app] NEXT_PUBLIC_TENANT_CURRENCY is not set — ' +
        `falling back to ${EMERGENCY_DISPLAY_FALLBACK_CURRENCY}. The deploy ` +
        'must set this per-tenant.',
    );
  }
  return EMERGENCY_DISPLAY_FALLBACK_CURRENCY;
}
