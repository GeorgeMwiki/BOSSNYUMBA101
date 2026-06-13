/**
 * connector_credentials — per-tenant per-account OAuth state for the
 * connector fabric.
 *
 * Companion to migration 0322_connector_credentials.sql. Backs the shared
 * credential store the connector fabric reads
 * (`services/api-gateway/src/composition/connector-fabric.ts`) and the
 * connector token cipher seals/unseals against
 * (`services/api-gateway/src/composition/connector-token-cipher.ts`).
 *
 * One row per (tenant_id, connector_kind, connector_account). `connector_account`
 * is the provider-side identifier (Slack workspace id, Gmail address, …).
 *
 * Token columns (`access_token_enc`, `refresh_token_enc`) are `bytea` carrying
 * AES-GCM ciphertext sealed with a tenant-bound DEK. The Drizzle binding is
 * `Uint8Array`; nothing in this schema sees plaintext. The connector packages'
 * auth/token-refresh path is the only decrypt path.
 *
 * Tenant-isolation: RLS FORCE-enabled in migration 0322 on the canonical
 * `current_setting('app.current_tenant_id', true)` GUC + a service-role bypass
 * (mirrors BossNyumba 0316/0317). UNIQUE on
 * (tenant_id, connector_kind, connector_account) — one row per account.
 *
 * NOTE on connector kinds: BossNyumba's connector catalogue
 * (`connector-catalog.ts`) ships a far broader kind set than the original
 * Borjie omnidata batch (slack/gmail/outlook-mail/google-calendar), so this
 * table does NOT carry a `connector_kind` CHECK enum — the catalogue is the
 * source of
 * truth for which kinds are valid, and pinning the enum here would reject
 * whatsapp / teams / notion / salesforce / github / … inserts.
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  customType,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Custom drizzle column wrapping Postgres `bytea`. Binds to `Uint8Array` in
 * TypeScript. The driver delivers a `Buffer` which we widen to `Uint8Array`
 * for portability.
 */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value) {
    return Buffer.from(value);
  },
  fromDriver(value) {
    return new Uint8Array(value);
  },
});

// ============================================================================
// connector_credentials — per-tenant per-account OAuth state
// ============================================================================

export const connectorCredentials = pgTable(
  'connector_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    /** slack | gmail | whatsapp | teams | notion | … (catalogue-defined). */
    connectorKind: text('connector_kind').notNull(),
    /** Provider-side account id (Slack workspace id, email address, …). */
    connectorAccount: text('connector_account').notNull(),
    /** ENCRYPTED-AT-REST. AES-GCM ciphertext sealed with tenant DEK. */
    accessTokenEnc: bytea('access_token_enc'),
    /** ENCRYPTED-AT-REST. AES-GCM ciphertext sealed with tenant DEK. */
    refreshTokenEnc: bytea('refresh_token_enc'),
    scopes: text('scopes').array().notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    auditHash: text('audit_hash').notNull(),
  },
  (t) => ({
    tenantKindIdx: index('idx_connector_creds_tenant_kind').on(
      t.tenantId,
      t.connectorKind,
    ),
  }),
);

export type ConnectorCredentialsRow = typeof connectorCredentials.$inferSelect;
export type ConnectorCredentialsInsert =
  typeof connectorCredentials.$inferInsert;
