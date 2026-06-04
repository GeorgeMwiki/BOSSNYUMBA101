// Centralised API config. EXPO_PUBLIC_* env vars are inlined at build time
// so they are safe to read from any runtime (web, iOS, Android).

const FALLBACK_GATEWAY = 'http://localhost:4001'

function readBaseUrl(): string {
  const raw =
    typeof process !== 'undefined' &&
    typeof process.env !== 'undefined' &&
    process.env.EXPO_PUBLIC_API_GATEWAY_URL
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/\/+$/, '')
  }
  return FALLBACK_GATEWAY
}

export const apiConfig = {
  baseUrl: readBaseUrl(),
  timeoutMs: 5_000
} as const

export type ApiConfig = typeof apiConfig

/**
 * Canonical prefix for the api-gateway tenant marketplace surface. The
 * renter-facing listing + application flows live under this prefix
 * (marketplaceRouter is mounted at `/api/v1/marketplace`).
 */
export const MARKETPLACE_PREFIX = '/api/v1/marketplace'

/**
 * Operator/manager surface root. The estate-manager workforce router is
 * mounted at `/api/v1/manager` (estateManagerAppRouter). Used for the
 * non-marketplace operator calls.
 */
export const MANAGER_PREFIX = '/api/v1/manager'

/**
 * @deprecated Compatibility alias retained ONLY so the not-yet-migrated
 * `src/api/buyers.ts` (renter-identity/profile calls, a non-owned file
 * in this pass) keeps compiling. Resolves to the manager surface root.
 * Migrate `buyers.ts` to the real tenant-identity endpoints, then delete
 * this alias. Tracked in flagged for coordinated follow-up.
 */
export const MINING_PREFIX = MANAGER_PREFIX
