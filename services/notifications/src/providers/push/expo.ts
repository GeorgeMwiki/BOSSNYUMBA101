/**
 * Expo Push provider — iOS + Android via the Expo Push API.
 *
 * WHY THIS EXISTS
 * ---------------
 * The mobile clients register an `ExponentPushToken[...]` (NOT a raw FCM
 * token) at `/api/v1/me/device-tokens`. Handing such a token straight to
 * Firebase Cloud Messaging (`admin.messaging().send({ token })`) is rejected —
 * an Expo token is meaningless to FCM. This provider routes Expo tokens through
 * Expo's HTTP push endpoint instead, so a device that registered via Expo
 * actually receives the push.
 *
 * It is registered on the `push` channel ALONGSIDE the Firebase provider. The
 * dispatcher fails over within the channel: this provider claims Expo tokens
 * and returns a NON-retryable `INVALID_RECIPIENT` for raw FCM/APNS tokens, so
 * the dispatcher hands those straight to Firebase (and vice-versa). Per-token
 * routing therefore happens through the existing channel-failover machinery
 * with no special-casing in the dispatcher.
 *
 * Endpoint:  POST https://exp.host/--/api/v2/push/send
 * Auth:      Optional. When `EXPO_ACCESS_TOKEN` is set it is sent as
 *            `Authorization: Bearer <token>`; Expo also accepts unauthenticated
 *            sends for projects without push security.
 *
 * Configured semantics: the provider is "configured" whenever push is not
 * explicitly disabled (`PUSH_DISABLED=true`) — the access token is optional, so
 * configuration does not depend on per-tenant credentials. When push is
 * disabled `isConfigured()` returns false and the dispatcher advances the
 * channel rather than sending.
 */

import { randomUUID } from 'crypto';

import type { TenantId } from '../../types/index.js';
import type { NotificationChannel, SendResult } from '../../types/index.js';
import type { INotificationProvider, SendParams } from '../provider.interface.js';
import { isExpoPushToken } from './token-kind.js';
import { lazySingleton } from '../../lazy-singleton.js';

const EXPO_DEFAULT_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TIMEOUT_MS = 15_000;

/** A `SendResult` carrying the dispatcher's optional non-retryable `errorCode`. */
type SendResultWithCode = SendResult & { errorCode?: string };

interface ExpoTicket {
  readonly status?: string;
  readonly id?: string;
  readonly message?: string;
  readonly details?: { readonly error?: string };
}

export interface ExpoPushConfig {
  /** Optional Expo access token (push security). */
  readonly accessToken?: string | null;
  /** Override endpoint (tests / Expo self-host). */
  readonly apiUrl?: string;
  /** Disable the rail entirely (mirrors `PUSH_DISABLED=true`). */
  readonly disabled?: boolean;
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Read Expo config from the environment. The access token is optional, so this
 * never throws; `disabled` follows `PUSH_DISABLED`.
 */
export function readExpoPushConfigFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ExpoPushConfig {
  return {
    accessToken: env['EXPO_ACCESS_TOKEN'] ?? null,
    ...(env['EXPO_PUSH_API_URL'] !== undefined ? { apiUrl: env['EXPO_PUSH_API_URL'] } : {}),
    disabled: env['PUSH_DISABLED'] === 'true',
  };
}

export class ExpoPushProvider implements INotificationProvider {
  readonly channel: NotificationChannel = 'push';
  readonly name = 'Expo Push';

  private readonly config: ExpoPushConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ExpoPushConfig = readExpoPushConfigFromEnv()) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Configured whenever push is not explicitly disabled. The Expo rail needs
   * no per-tenant credential, so this is tenant-independent — the per-token
   * Expo-vs-FCM decision happens in `send()`.
   */
  isConfigured(_tenantId: TenantId): boolean {
    return this.config.disabled !== true;
  }

  async send(params: SendParams): Promise<SendResult> {
    // Only Expo tokens belong on this rail. A raw FCM/APNS token is a
    // permanent mismatch for THIS provider — signal a non-retryable
    // INVALID_RECIPIENT so the dispatcher fails over to Firebase rather than
    // burning the retry budget or POSTing a foreign token to Expo.
    if (!isExpoPushToken(params.to)) {
      const mismatch: SendResultWithCode = {
        success: false,
        error: 'token is not an Expo push token',
        errorCode: 'INVALID_RECIPIENT',
      };
      return mismatch;
    }

    const url = this.config.apiUrl ?? EXPO_DEFAULT_URL;
    const message = {
      to: params.to,
      title: params.title ?? params.subject ?? 'Notification',
      body: params.body,
      data: params.data ?? {},
      sound: 'default' as const,
    };

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(this.config.accessToken
            ? { authorization: `Bearer ${this.config.accessToken}` }
            : {}),
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
      });

      if (response.status < 200 || response.status >= 300) {
        const result: SendResultWithCode = {
          success: false,
          error: `expo http ${response.status}`,
          ...(isRetryableHttpStatus(response.status)
            ? {}
            : { errorCode: 'INVALID_RECIPIENT' }),
        };
        return result;
      }

      const ticket = await parseTicket(response);
      return mapTicket(ticket);
    } catch (err) {
      // Network / timeout — retryable (no errorCode marks it non-retryable).
      const detail = err instanceof Error ? err.message : String(err);
      return { success: false, error: `expo: ${detail}` };
    }
  }
}

function mapTicket(ticket: ExpoTicket | null): SendResult {
  if (ticket && ticket.status === 'ok') {
    return { success: true, externalId: ticket.id ?? `expo_${randomUUID()}` };
  }
  const expoError = ticket?.details?.error ?? 'UnknownError';
  const rawMessage = ticket?.message ?? 'Expo push ticket reported an error.';
  const result: SendResultWithCode = {
    success: false,
    error: `expo ticket ${expoError}: ${rawMessage}`,
    // Only a rate limit is transient; every other Expo ticket error is
    // permanent for this (token, payload) pair.
    ...(expoError === 'MessageRateExceeded'
      ? {}
      : { errorCode: 'INVALID_RECIPIENT' }),
  };
  return result;
}

/**
 * Expo wraps tickets in `{ data: [...] }` (one entry per `to`). We send one
 * token per request, so the ticket is `data[0]`. A bare-object `data` is
 * tolerated too.
 */
async function parseTicket(response: { text(): Promise<string> }): Promise<ExpoTicket | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    const parsed = JSON.parse(text) as { data?: unknown };
    const data = parsed.data;
    if (Array.isArray(data)) {
      const first = data[0];
      return isTicket(first) ? first : null;
    }
    return isTicket(data) ? data : null;
  } catch {
    return null;
  }
}

function isTicket(value: unknown): value is ExpoTicket {
  return typeof value === 'object' && value !== null;
}

function isRetryableHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  return false;
}

export const expoPushProvider = lazySingleton(() => new ExpoPushProvider());
