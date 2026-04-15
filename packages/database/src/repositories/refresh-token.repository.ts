/**
 * RefreshTokenRepository
 *
 * Data access for the refresh-token rotation flow used by the API gateway.
 * Tokens themselves are opaque random strings; only their SHA-256 hash is
 * persisted (see `refresh_tokens.token_hash`).
 *
 * Responsibilities:
 *   - create()                : persist a freshly-issued refresh token
 *   - findByTokenHash(hash)   : lookup for /refresh validation
 *   - markUsed(id, nextHash)  : link rotation chain on successful refresh
 *   - revokeByUserId(userId)  : nuke every active token for a user (compromise)
 *   - revokeByHash(hash)      : revoke a single token (logout)
 *   - deleteExpired()         : housekeeping
 */

import { and, eq, isNull, lt } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { refreshTokens } from '../schemas/index.js';

type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export interface CreateRefreshTokenInput {
  id?: string;
  userId: string;
  tenantId: string;
  deviceId?: string | null;
  tokenHash: string;
  expiresAt: Date;
  issuedAt?: Date;
}

export class RefreshTokenRepository {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Insert a freshly-issued refresh token.
   */
  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRow> {
    const values: typeof refreshTokens.$inferInsert = {
      // id is optional — DB defaults via gen_random_uuid() in the migration.
      // When the caller is in an environment without that default (e.g. tests
      // running against a synthetic client) they can pass an explicit id.
      ...(input.id ? { id: input.id } : {}),
      userId: input.userId,
      tenantId: input.tenantId,
      deviceId: input.deviceId ?? null,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      ...(input.issuedAt ? { issuedAt: input.issuedAt } : {}),
    };

    const [row] = await this.db.insert(refreshTokens).values(values).returning();
    if (!row) throw new Error('Failed to create refresh token');
    return row;
  }

  /**
   * Lookup a token row by its SHA-256 hash. Returns null if no row matches —
   * callers MUST also enforce expires_at and revoked_at semantics.
   */
  async findByTokenHash(hash: string): Promise<RefreshTokenRow | null> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Mark a token as consumed during rotation: stamp last_used_at, revoked_at,
   * and link to the successor's hash so any future re-use of `id` can be
   * detected as a replay attempt.
   */
  async markUsed(id: string, replacedByHash: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(refreshTokens)
      .set({
        lastUsedAt: now,
        revokedAt: now,
        replacedByTokenHash: replacedByHash,
      })
      .where(eq(refreshTokens.id, id));
  }

  /**
   * Revoke every still-active refresh token for a user. Used on
   * compromise detection (re-use of an already-rotated token) and on
   * "logout from all devices".
   */
  async revokeByUserId(userId: string): Promise<number> {
    const now = new Date();
    const result = await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return result.length;
  }

  /**
   * Revoke a single refresh token by its hash. Used by /logout.
   */
  async revokeByHash(hash: string): Promise<boolean> {
    const now = new Date();
    const result = await this.db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return result.length > 0;
  }

  /**
   * Housekeeping: remove rows whose expires_at is in the past. Safe to call
   * from a periodic job. Returns the number of rows deleted.
   */
  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, now))
      .returning({ id: refreshTokens.id });
    return result.length;
  }
}
