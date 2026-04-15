/**
 * Refresh Tokens Schema
 *
 * Stores hashed refresh tokens that back the access-token rotation flow in the
 * API gateway. Tokens themselves are opaque random 256-bit strings (NOT JWTs);
 * we persist only the SHA-256 hash so a database leak cannot be replayed.
 *
 * Rotation chain:
 *   On each refresh we mark the consumed row with `replacedByTokenHash` and
 *   issue a new row. If a previously-used (or otherwise revoked) token is ever
 *   presented again, the entire chain belonging to (user_id, device_id) is
 *   revoked — this is the compromise-detection signal.
 */

import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),

    // Ownership
    userId: text('user_id').notNull(),
    tenantId: text('tenant_id').notNull(),

    // Device binding (optional; sourced from X-Device-Id header). When present,
    // logout/compromise-revocation can scope to the single device's chain.
    deviceId: text('device_id'),

    // SHA-256(refresh_token). Never store the plaintext token.
    tokenHash: text('token_hash').notNull(),

    // Lifecycle
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    // Rotation chain link: when this token is consumed during refresh, this
    // points at the SHA-256 hash of its successor. NULL means "current head"
    // (or simply revoked/expired without a successor).
    replacedByTokenHash: text('replaced_by_token_hash'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: index('refresh_tokens_token_hash_idx').on(table.tokenHash),
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    tenantIdIdx: index('refresh_tokens_tenant_id_idx').on(table.tenantId),
    deviceIdIdx: index('refresh_tokens_device_id_idx').on(table.deviceId),
    expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
    userDeviceIdx: index('refresh_tokens_user_device_idx').on(table.userId, table.deviceId),
  })
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
