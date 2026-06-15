/**
 * Workforce invitation-activation helper.
 *
 * Pure async function that POSTs the (phone, 6-digit code) pair to the
 * public api-gateway workforce-activation endpoint and returns the Supabase
 * session payload on success. The activation SCREEN that wires this helper is
 * not yet built; the helper is contract-first and kept pure/testable so the
 * screen can adopt it unchanged.
 *
 * The endpoint is unauthenticated (workers do not have a token yet) so
 * we issue the request without a bearer header — `request()` only
 * attaches the bearer when present, so the call site does not need to
 * thread anything special.
 *
 * Lockout (rate-limiting the 3-attempt-per-3-minute window) is a SCREEN
 * concern; this helper deliberately stays state-free.
 */

import { API_BASE_URL } from '../api/config'
import { request } from '../api/client'
import type { Role } from '../roles/types'

// NOTE: the backend phone+code workforce invite-activation route is owned by
// the api-gateway team and is NOT yet mounted (no `/api/v1/workforce/*` exists
// in services/api-gateway/src/index.ts as of this change). This path is the
// agreed namespace the gateway route will be mounted at; until then the call
// fails closed and the screen surfaces the activation error. Do not point this
// at an unrelated existing route (e.g. the token+password `/auth/accept-invite`
// flow) — the contract (phone + 6-digit code) is different.
const ACTIVATION_PATH = '/api/v1/workforce/invites/activate'

/**
 * E.164 normaliser — strips spaces, trims, ensures leading '+'. Returns
 * the canonical form the api-gateway zod schema expects.
 */
export function normaliseE164(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, '')
  if (trimmed.startsWith('+')) {
    return trimmed
  }
  return `+${trimmed.replace(/^0+/, '')}`
}

/**
 * Lightweight client-side validators. The server is the source of
 * truth — this is just to short-circuit a bad submit before a round
 * trip and to render the right error label.
 */
export function isPhoneValid(phone: string): boolean {
  return /^\+[1-9][0-9]{6,14}$/.test(normaliseE164(phone))
}

export function isCodeValid(code: string): boolean {
  return /^[0-9]{6}$/.test(code.trim())
}

export interface ActivationSession {
  readonly accessToken: string | null
  readonly refreshToken: string | null
  readonly expiresIn: number | null
}

export interface ActivationResult {
  readonly invitationId: string
  readonly tenantId: string
  readonly userId: string
  // Real-estate workforce role vocabulary (src/roles/types.ts), not the
  // unported MINING-vertical `mining_role`. A workforce invite resolves to a
  // manager or maintenance-staff (`employee`) seat; `owner` is provisioned
  // through the owner onboarding flow, not a workforce activation code.
  readonly workforceRole: Extract<Role, 'manager' | 'employee'>
  readonly session: ActivationSession
}

export interface ActivationErrorShape {
  readonly code: string
  readonly message: string
}

interface RawActivationResponse {
  readonly success: boolean
  readonly data?: ActivationResult
  readonly error?: ActivationErrorShape
}

/**
 * Activate an invitation. Throws `ApiError` from the underlying client
 * on non-2xx; the caller catches and renders a user-friendly toast.
 */
export async function activateInvitation(input: {
  readonly phoneE164: string
  readonly activationCode: string
}): Promise<ActivationResult> {
  const phoneE164 = normaliseE164(input.phoneE164)
  const activationCode = input.activationCode.trim()
  const url = `${API_BASE_URL}${ACTIVATION_PATH}`
  const response = await request<RawActivationResponse>(url, {
    method: 'POST',
    body: { phoneE164, activationCode }
  })
  if (!response.success || !response.data) {
    const code = response.error?.code ?? 'ACTIVATION_FAILED'
    const message = response.error?.message ?? 'Activation failed'
    throw new ActivationFailedError(code, message)
  }
  return response.data
}

/**
 * Typed error so the screen can branch on the `code` field for i18n
 * without parsing strings.
 */
export class ActivationFailedError extends Error {
  public readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ActivationFailedError'
    this.code = code
  }
}
