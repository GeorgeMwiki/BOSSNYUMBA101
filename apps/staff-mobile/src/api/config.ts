import Constants from 'expo-constants'

/**
 * Resolve API gateway URL with this precedence:
 *  1. EXPO_PUBLIC_API_GATEWAY_URL env var (highest — set in EAS / .env)
 *  2. expoConfig.extra.apiGatewayUrl from app.json (dev fallback)
 *  3. hard fallback to localhost:4001 (matches the api-gateway dev port)
 *
 * The URL never ends with a trailing slash so callers can safely concatenate.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_GATEWAY_URL
  const fromConfig = Constants.expoConfig?.extra?.['apiGatewayUrl'] as
    | string
    | undefined
  const raw = fromEnv ?? fromConfig ?? 'http://localhost:4001'
  return raw.replace(/\/+$/u, '')
}

export const API_BASE_URL: string = resolveBaseUrl()
export const DEFAULT_TIMEOUT_MS = 5_000

// Legacy worker/owner prefixes — kept so existing field/owner/chat call
// sites keep compiling while screens migrate to the canonical operator
// prefix. The api-gateway exposes the worker self-service surface under
// '/api/v1/field/staff' and the owner cockpit under '/api/v1/owner/*'.
export const FIELD_PREFIX = '/api/v1/field'
export const OWNER_PREFIX = '/api/v1/owner'
// Master Brain SSE entry — authenticated workforce chat. The canonical
// streaming transport the chat UIs consume is POST /api/v1/ai/chat
// (ai-chat.router.ts). Public/unauthenticated chat lives at
// '/api/v1/public/sandbox' (used by the public sandbox surface).
export const CHAT_PREFIX = '/api/v1/ai/chat'

/**
 * Canonical prefix for the api-gateway estate-manager surface. The
 * staff-mobile operator screens reach the workforce surface through the
 * BossNyumba manager router (api.route('/manager', estateManagerAppRouter)).
 * All new wiring (sync queue flushes, screen fetches) goes through this
 * prefix; the legacy field/owner prefixes above are kept for migration.
 *
 * NOTE: the export name is retained for source compatibility with
 * `src/api/client.ts` (and a handful of other call sites) that import it;
 * a coordinated rename to OPERATOR_PREFIX is flagged for follow-up.
 */
export const MINING_PREFIX = '/api/v1/manager'

export interface ApiPaths {
  readonly field: string
  readonly owner: string
  readonly chat: string
  readonly operator: string
}

export const apiPaths: ApiPaths = {
  field: `${API_BASE_URL}${FIELD_PREFIX}`,
  owner: `${API_BASE_URL}${OWNER_PREFIX}`,
  chat: `${API_BASE_URL}${CHAT_PREFIX}`,
  operator: `${API_BASE_URL}${MINING_PREFIX}`
}
