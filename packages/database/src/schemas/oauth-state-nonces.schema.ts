/**
 * oauth_state_nonces — DURABLE single-use consumption of the connector-OAuth
 * `state` nonce (multi-replica replay protection).
 *
 * Companion to migration 0323. The connector OAuth connect flow
 * (services/api-gateway/src/routes/integrations/connectors-oauth.hono.ts)
 * authenticates its provider callback with an HMAC-signed single-use `state`
 * (nonce + expiry). Because api-gateway autoscales to multiple replicas, a
 * captured `state` could be replayed against a replica that never saw the first
 * consumption. This table is the cluster-wide authority: the callback CONSUMES
 * each nonce with `INSERT ... ON CONFLICT (nonce) DO NOTHING RETURNING nonce` —
 * exactly one replica ever gets a row back; every replay gets 0 rows and is
 * rejected with STATE_ALREADY_USED. The same consume statement purges rows
 * older than the retention window (15 min; signature TTL is 10) so the table
 * stays tiny without a dedicated sweeper.
 *
 * Source-of-truth note: the durable nonce store
 * (`services/api-gateway/src/composition/oauth-state-nonce-store.ts`) speaks
 * plain parameterised SQL against these exact column names. This schema exists
 * for type-safe consumers inside `@bossnyumba/database` + migration tests; the
 * column set MUST stay in lockstep with migration 0323.
 *
 * `tenant_id` is NULLABLE — the table is platform-scoped infrastructure (the
 * callback carries no JWT; identity comes from the verified state). Tenant
 * isolation (RLS FORCE on `current_setting('app.current_tenant_id', true)`,
 * bound from the VERIFIED state inside the consume transaction) plus a
 * service-role bypass for platform ops / cross-tenant cleanup are installed by
 * migration 0323. Nonces are opaque random values — no PII, no token material.
 */

import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

// ============================================================================
// oauth_state_nonces — one row per consumed connector-OAuth state nonce
// ============================================================================

export const oauthStateNonces = pgTable(
  'oauth_state_nonces',
  {
    /**
     * The single-use state nonce (opaque random value). PRIMARY KEY is the
     * ON CONFLICT arbiter that makes consumption exactly-once cluster-wide.
     */
    nonce: text('nonce').primaryKey(),
    /**
     * NULLABLE: platform-scoped infrastructure table. Today's connector flow
     * always writes the verified state's tenant; future platform-scoped OAuth
     * flows may consume nonces with no tenant.
     */
    tenantId: text('tenant_id'),
    /** Which connector's connect flow minted the state (observability only). */
    connectorId: text('connector_id'),
    /** The absolute expiry the state signature carries (signature TTL = 10 min). */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    /** Inline-purge predicate scans by creation time. */
    createdIdx: index('oauth_state_nonces_created_idx').on(t.createdAt),
  }),
);

export type OAuthStateNonceRow = typeof oauthStateNonces.$inferSelect;
export type OAuthStateNonceInsert = typeof oauthStateNonces.$inferInsert;
