/**
 * Refresh-token mint + verify (AM-1).
 *
 * Mints/verifies the 7-day refresh JWTs that ride the httpOnly
 * `bn_refresh` cookie. Distinct from access tokens in three ways:
 *
 *   1. Signed with `JWT_REFRESH_SECRET` (not `JWT_SECRET`). Stops the
 *      "use an access token as a refresh token" substitution attack.
 *   2. Carries only `sub` (userId), `sid` (sessionId/family), and `jti`
 *      — none of the role/tenant claims an access token does. The
 *      issuer mints a *fresh* access JWT against the database on each
 *      refresh, so claim drift (role change, tenant suspension, etc.)
 *      is honoured promptly.
 *   3. 7-day expiry vs the access token's 1 hour. Compromise window
 *      is intentionally large for this cookie because it lives in
 *      httpOnly storage and is delivered only over TLS — its threat
 *      model is "stolen at-rest" not "exfiltrated in flight".
 *
 * Rotation:
 *   On every successful /auth/refresh, the old jti is added to
 *   `refreshTokenBlocklist` and a brand-new refresh JWT is minted.
 *   This implements refresh-token rotation: replay of the old token
 *   fails the blocklist check.
 */

import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getJwtRefreshSecret } from '../config/jwt';

export interface RefreshTokenPayload {
  /** User ID — same shape as access-token sub. */
  sub: string;
  /** Session ID / family — multiple refresh tokens may share this. */
  sid: string;
  /** JWT ID — used by `refreshTokenBlocklist` for revocation. */
  jti: string;
  iat: number;
  exp: number;
}

const REFRESH_TTL = '7d';

/** Mint a fresh refresh JWT. Pass the userId; sid defaults to a fresh UUID. */
export function generateRefreshToken(opts: {
  readonly userId: string;
  readonly sessionId?: string;
}): { token: string; jti: string; sid: string } {
  const sid = opts.sessionId ?? randomUUID();
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: opts.userId, sid },
    getJwtRefreshSecret(),
    {
      expiresIn: REFRESH_TTL,
      jwtid: jti,
      algorithm: 'HS256',
    }
  );
  return { token, jti, sid };
}

export interface VerifyResult {
  readonly valid: boolean;
  readonly expired: boolean;
  readonly payload?: RefreshTokenPayload;
  readonly error?: string;
}

export function verifyRefreshToken(token: string): VerifyResult {
  try {
    const payload = jwt.verify(token, getJwtRefreshSecret(), {
      algorithms: ['HS256'],
    }) as RefreshTokenPayload;
    return { valid: true, expired: false, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valid: false, expired: true, error: 'Refresh token expired' };
    }
    return {
      valid: false,
      expired: false,
      error: err instanceof Error ? err.message : 'Invalid refresh token',
    };
  }
}
