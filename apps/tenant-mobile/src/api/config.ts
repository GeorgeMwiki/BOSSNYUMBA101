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
 * non-marketplace operator calls, including the renter-identity/profile
 * + KYC endpoints in `src/api/applicants.ts`.
 */
export const MANAGER_PREFIX = '/api/v1/manager'
