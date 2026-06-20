/**
 * Lightweight JWT claim parser — base64-decodes the middle segment of a
 * JWT to extract BossNyumba-domain custom claims (`app_metadata.tenant_id`,
 * `app_metadata.workforce_role`). We intentionally avoid adding a `jose` or
 * `jwt-decode` dependency: signature verification happens server-side in
 * api-gateway (`services/api-gateway/src/auth/supabase/supabase-jwt-verify.ts`).
 *
 * The mobile client only inspects claims to drive UI routing — it never
 * trusts them for authorisation, so an unsigned parse is safe.
 *
 * Real-estate vertical: the canonical role claim is `workforce_role`. The
 * legacy `mining_role` key (residue from the mining vertical this app was
 * forked from) is still accepted as a deprecated fallback so any token
 * minted before the rename keeps routing; new tokens use `workforce_role`.
 */

import type { Role } from '../roles/types'

export interface SupabaseTokenClaims {
  readonly userId: string
  readonly tenantId: string | null
  readonly workforceRole: string | null
  readonly role: Role | null
  readonly phone: string | null
}

interface RawJwtPayload {
  readonly sub?: string
  readonly phone?: string
  readonly app_metadata?: {
    readonly tenant_id?: string
    readonly workforce_role?: string
    /** @deprecated mining-vertical residue — read as a fallback only. */
    readonly mining_role?: string
    readonly roles?: ReadonlyArray<string>
  }
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (padded.length % 4)) % 4
  const normalised = padded + '='.repeat(padding)
  if (typeof atob === 'function') {
    return atob(normalised)
  }
  // Node / vitest environment fallback
  const g = globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }
  if (g.Buffer) {
    return g.Buffer.from(normalised, 'base64').toString('utf-8')
  }
  throw new Error('No base64 decoder available in this runtime')
}

function mapWorkforceRoleToRole(workforceRole: string | null): Role | null {
  if (!workforceRole) return null
  const lower = workforceRole.toLowerCase()
  if (lower === 'owner') return 'owner'
  // `site_manager` / `driver` / `field_employee` are legacy mining-vertical
  // values kept in the map so already-minted tokens still route; the canonical
  // real-estate vocabulary is manager / employee / maintenance_staff.
  if (lower === 'site_manager' || lower === 'manager') return 'manager'
  if (
    lower === 'driver' ||
    lower === 'employee' ||
    lower === 'maintenance_staff' ||
    lower === 'field_employee'
  ) {
    return 'employee'
  }
  return null
}

/**
 * Decode the payload segment of a Supabase access token. Returns `null` if
 * the token is malformed; callers must handle that case (e.g. force sign-out).
 */
export function parseSupabaseToken(accessToken: string): SupabaseTokenClaims | null {
  if (!accessToken || typeof accessToken !== 'string') return null
  const segments = accessToken.split('.')
  if (segments.length !== 3) return null
  const middle = segments[1]
  if (!middle) return null

  try {
    const decoded = base64UrlDecode(middle)
    const payload = JSON.parse(decoded) as RawJwtPayload
    const appMd = payload.app_metadata ?? {}
    // Canonical `workforce_role`, falling back to the deprecated
    // `mining_role` so pre-rename tokens keep routing.
    const workforceRole = appMd.workforce_role ?? appMd.mining_role ?? null
    const role = mapWorkforceRoleToRole(workforceRole) ??
      mapWorkforceRoleToRole(appMd.roles?.[0] ?? null)
    return {
      userId: payload.sub ?? '',
      tenantId: appMd.tenant_id ?? null,
      workforceRole,
      role,
      phone: payload.phone ?? null
    }
  } catch {
    return null
  }
}
