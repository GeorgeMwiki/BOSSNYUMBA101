/**
 * Supabase Auth integration — barrel export.
 *
 * Provides:
 *   - `buildSupabaseAuthRoutes` — Hono sub-app to mount under
 *     `/auth/supabase/*` for sign-up / sign-in / magic-link / OTP /
 *     refresh / sign-out passthrough.
 *   - Session helpers for SSR cookie rotation.
 *
 * NOTE: token verification is NOT exported here. The canonical Supabase
 * JWT verifier is `verifySupabaseJwt` from `@bossnyumba/ai-copilot`
 * (JWKS/ES256 + HS256 fallback, iss/aud pinning), projected onto the
 * gateway `AuthContext` by `middleware/auth.middleware.ts`. The weaker
 * inline HS256-only verifier + its `AUTH_PROVIDER=supabase` middleware
 * were removed (dead-code cleanup) — they skipped issuer/audience checks
 * and accepted a tenant claim from `user_metadata`.
 */

export { buildSupabaseAuthRoutes } from './supabase-auth-routes.js';

export {
  rotateSession,
  shouldRotate,
  buildSessionCookie,
  SupabaseSessionError,
  type SupabaseSessionResponse,
  type SessionRotationConfig,
  type SessionCookieOptions,
} from './supabase-session.js';
