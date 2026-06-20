/**
 * Push fan-out enqueuer — the READ leg of the device-token loop.
 *
 * WHY THIS EXISTS
 * ---------------
 * `device_tokens` (migration 0330) was write-only: the canonical
 * `/api/v1/me/device-tokens` surface (services/api-gateway/src/routes/me.hono.ts)
 * INSERTs/refreshes a row per device and soft-revokes via `revoked_at`, but
 * NOTHING read those rows back to actually dispatch a push. So a device could
 * register and still never receive a notification — a half-loop.
 *
 * This module closes the loop: given a `userId` + `tenantId`, it reads the
 * user's LIVE (`revoked_at IS NULL`) device tokens and enqueues ONE push per
 * token through the canonical `enqueueNotification` dispatcher. The dispatcher
 * then routes each token to the correct rail — Expo for `ExponentPushToken[...]`
 * receivers, Firebase for raw FCM/APNS tokens (see `providers/index.ts`) — and
 * inherits all of the dispatcher's reliability guarantees (preference re-check,
 * provider failover, retry/backoff, cross-channel fallback, DLQ).
 *
 * Mirrors Borjie's pattern, where the producer resolves a user's
 * `device_push_tokens` into one dispatch row per token before fan-out.
 *
 * DB ACCESS — driver-agnostic by design
 * -------------------------------------
 * This service has NO database driver dependency (no drizzle / pg in its
 * package). The token READ is therefore an injected port: the caller — the
 * api-gateway, which already holds the live Drizzle client and binds the
 * `app.current_tenant_id` GUC — supplies a `loadLiveTokens` function. The
 * canonical query the gateway should run is:
 *
 *   SELECT token
 *     FROM device_tokens
 *    WHERE tenant_id = $tenantId
 *      AND user_id   = $userId
 *      AND revoked_at IS NULL
 *    ORDER BY last_seen_at DESC
 *
 * (uses the `idx_device_tokens_tenant_user_active` partial index; tenant
 * isolation is enforced by RLS + the GUC, the predicate is defence in depth.)
 *
 * `makeTokenLoaderFromExecutor` adapts any `{ execute(query) }`-shaped client
 * (the same shape api-gateway route handlers see as `c.get('db')`) into a
 * `LoadLiveTokens` without this package importing a query builder.
 */

import { enqueueNotification } from './dispatcher.js';
import type {
  DispatcherDeps,
  DispatchResult,
  NotificationPriority,
} from './dispatcher.js';
import type {
  NotificationTemplateId,
  TenantId,
} from './types/index.js';
import { logger } from './logger.js';

/**
 * Injected token-read port. Returns the user's LIVE device tokens
 * (`revoked_at IS NULL`), most-recently-seen first. Implemented by the caller
 * against `device_tokens` (the gateway binds the tenant GUC; see the canonical
 * query in this file's header).
 */
export type LoadLiveTokens = (
  tenantId: TenantId,
  userId: string,
) => Promise<readonly string[]>;

export interface EnqueuePushToUserInput {
  tenantId: TenantId;
  userId: string;
  templateId: NotificationTemplateId;
  /** Pre-rendered push title. */
  title?: string;
  /** Pre-rendered push body. */
  body: string;
  /** Optional structured data delivered alongside the push. */
  data?: Record<string, string>;
  priority?: NotificationPriority;
  correlationId?: string;
  /**
   * Idempotency key seed. When set, each per-token dispatch derives a stable
   * key (`<seed>:<token>`) so a redelivery of the SAME push to the SAME token
   * is de-duplicated by the dispatcher.
   */
  idempotencyKey?: string;
}

export interface EnqueuePushToUserResult {
  /** Number of live device tokens found for the user. */
  tokensFound: number;
  /** Number of per-token dispatches the dispatcher accepted. */
  accepted: number;
  /** Per-token dispatch results, in token order. */
  results: readonly DispatchResult[];
}

/** Normalise a raw driver result (array OR `{ rows: [...] }`) into rows. */
function rowsOf(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows?: unknown }).rows;
    if (Array.isArray(r)) return r as Array<Record<string, unknown>>;
  }
  return [];
}

/**
 * Adapt an `{ execute(query) }` client (the gateway's `c.get('db')` shape)
 * into a `LoadLiveTokens`. The caller passes a query factory so this package
 * never imports a query builder (`drizzle-orm` / `pg`) — keeping the
 * notifications service driver-agnostic. Example at the call site:
 *
 *   const load = makeTokenLoaderFromExecutor(db, (tenantId, userId) => sql`
 *     SELECT token FROM device_tokens
 *      WHERE tenant_id = ${tenantId} AND user_id = ${userId}
 *        AND revoked_at IS NULL
 *      ORDER BY last_seen_at DESC`);
 */
export function makeTokenLoaderFromExecutor(
  db: { execute(query: unknown): Promise<unknown> },
  buildQuery: (tenantId: TenantId, userId: string) => unknown,
): LoadLiveTokens {
  return async (tenantId, userId) => {
    const raw = await db.execute(buildQuery(tenantId, userId));
    return rowsOf(raw)
      .map((r) => (typeof r['token'] === 'string' ? (r['token'] as string) : ''))
      .filter((t) => t.length > 0);
  };
}

/**
 * Fan a push out to EVERY live device a user has registered.
 *
 * Reads the user's live device tokens via the injected `loadLiveTokens` and
 * enqueues one push per token through the canonical dispatcher. Returns a
 * summary (tokens found, dispatches accepted, per-token results). When the user
 * has no live token the result is empty — a no-op, not an error (the user
 * simply isn't reachable by push right now).
 *
 * @param loadLiveTokens Injected token-read port (caller binds tenant GUC).
 * @param input          Recipient + rendered push content.
 * @param deps           Optional dispatcher dependency overrides (tests).
 */
export async function enqueuePushToUser(
  loadLiveTokens: LoadLiveTokens,
  input: EnqueuePushToUserInput,
  deps: DispatcherDeps = {},
): Promise<EnqueuePushToUserResult> {
  const tokens = (await loadLiveTokens(input.tenantId, input.userId)).filter(
    (t) => typeof t === 'string' && t.length > 0,
  );

  if (tokens.length === 0) {
    logger.info('push.fanout.no_live_tokens', {
      tenantId: input.tenantId as string,
      userId: input.userId,
      templateId: String(input.templateId),
    });
    return { tokensFound: 0, accepted: 0, results: [] };
  }

  const results: DispatchResult[] = [];
  for (const token of tokens) {
    const result = await enqueueNotification(
      {
        tenantId: input.tenantId,
        userId: input.userId,
        channel: 'push',
        templateId: input.templateId,
        recipient: token,
        body: input.body,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.data !== undefined ? { data: input.data } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.correlationId !== undefined
          ? { correlationId: input.correlationId }
          : {}),
        // Per-token idempotency: same push to the same token de-dupes.
        ...(input.idempotencyKey !== undefined
          ? { idempotencyKey: `${input.idempotencyKey}:${token}` }
          : {}),
      },
      deps,
    );
    results.push(result);
  }

  const accepted = results.filter((r) => r.accepted).length;
  logger.info('push.fanout.complete', {
    tenantId: input.tenantId as string,
    userId: input.userId,
    templateId: String(input.templateId),
    tokensFound: tokens.length,
    accepted,
  });

  return { tokensFound: tokens.length, accepted, results };
}
