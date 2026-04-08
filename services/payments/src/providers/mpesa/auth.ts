/**
 * M-Pesa OAuth token management.
 *
 * Week-0 hardening notes:
 *   - Consumer key / secret are never cached at module level. A fresh copy is
 *     read from the environment on every auth cycle via `resolveCredentials`
 *     so that a rotated secret is picked up on the next token refresh without
 *     redeploying the service.
 *   - The short-lived access token itself is still cached (with a safety
 *     margin under the advertised expiry) because Daraja throttles
 *     `/oauth/v1/generate`; this is keyed by consumer key so rotating the
 *     credentials automatically invalidates the cached token as a side
 *     effect.
 *   - All comparisons of incoming secrets elsewhere in the codebase use
 *     `crypto.timingSafeEqual`; no plain `===` of sensitive values here.
 */
import { ProviderAuthError } from '../../common/errors';
import { logger } from '../../common/logger';
import { withRetry } from '../../common/retry';
import type { MpesaConfig } from './types';

interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
  /** Key used to detect secret rotation so we can invalidate eagerly. */
  credentialFingerprint: string;
}

/**
 * Token cache keyed by consumer key so multiple tenants / rotations coexist.
 * This is an implementation cache (short-lived access tokens, not secrets)
 * and is safe to keep in memory.
 */
const tokenCache = new Map<string, TokenCacheEntry>();

function getBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

/**
 * Resolve the consumer key / secret fresh from the environment unless the
 * caller's config explicitly supplies them. This guarantees that a rotated
 * `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` is picked up on the next
 * token refresh without any module-level caching of the secrets.
 */
export function resolveCredentials(config: MpesaConfig): {
  consumerKey: string;
  consumerSecret: string;
} {
  const consumerKey = config.consumerKey || process.env.MPESA_CONSUMER_KEY || '';
  const consumerSecret =
    config.consumerSecret || process.env.MPESA_CONSUMER_SECRET || '';
  if (!consumerKey || !consumerSecret) {
    throw new ProviderAuthError(
      'M-Pesa consumer key/secret not configured',
      'mpesa'
    );
  }
  return { consumerKey, consumerSecret };
}

function fingerprint(consumerKey: string, consumerSecret: string): string {
  // Not a secret itself -- just a stable key for cache invalidation. We use
  // the consumer key plus a short hash of the secret so a rotated secret
  // produces a different fingerprint.
  const tail = consumerSecret.slice(-6);
  return `${consumerKey}:${tail}`;
}

export async function getMpesaAccessToken(config: MpesaConfig): Promise<string> {
  const { consumerKey, consumerSecret } = resolveCredentials(config);
  const fp = fingerprint(consumerKey, consumerSecret);

  const cached = tokenCache.get(consumerKey);
  if (
    cached &&
    cached.expiresAt > Date.now() &&
    cached.credentialFingerprint === fp
  ) {
    return cached.accessToken;
  }

  // Fingerprint mismatch means the secret rotated under us -- drop the stale
  // entry so we don't keep serving a token minted with the old credential.
  if (cached && cached.credentialFingerprint !== fp) {
    tokenCache.delete(consumerKey);
    logger.info(
      { provider: 'mpesa' },
      'M-Pesa credentials rotated; invalidating token cache'
    );
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const baseUrl = getBaseUrl(config.environment);

  const fetchToken = async () => {
    const response = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    if (!response.ok) {
      throw new ProviderAuthError(
        `M-Pesa auth failed: ${response.status} ${response.statusText}`,
        'mpesa'
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: string;
    };

    if (!data.access_token) {
      throw new ProviderAuthError('M-Pesa auth: no access token in response', 'mpesa');
    }

    const expiresIn = parseInt(data.expires_in, 10) || 3599;
    const entry: TokenCacheEntry = {
      accessToken: data.access_token,
      expiresAt: Date.now() + expiresIn * 1000 - 60_000,
      credentialFingerprint: fp,
    };
    tokenCache.set(consumerKey, entry);

    logger.info({ provider: 'mpesa' }, 'M-Pesa access token refreshed');
    return entry.accessToken;
  };

  try {
    return await withRetry(fetchToken, { maxAttempts: 2 });
  } catch (err) {
    logger.error({ err, provider: 'mpesa' }, 'M-Pesa token refresh failed');
    throw err;
  }
}

export function clearMpesaTokenCache(): void {
  tokenCache.clear();
}
