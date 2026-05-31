/**
 * Unified Personal Knowledge Base — `persons` + `person_links`.
 *
 * Companion to migration 0296 and the federated-PKB design ported from
 * Borjie. One human can simultaneously be landlord at Tenant A, estate-
 * manager at Tenant B, accountant at Tenant C, and renter at Tenant D.
 * The canonical identity (her name, phone, language preference, life
 * events) lives in the `persons` table; each `person_links` row is one
 * "hat" she wears at one tenant under one Supabase auth principal.
 *
 * RLS posture: NEITHER table has Row Level Security enabled. They are
 * platform-level identity registries (mirroring the precedent of
 * `platform_memory_cells`). Access is gated above this layer by the
 * api-gateway middleware — typically via the service-role connection
 * for identity-resolution lookups, or by a future `app.current_person_id`
 * GUC predicate.
 *
 * No `tenant_id` column on `persons` by design — a person exists
 * orthogonally to any tenant. `person_links.tenant_id` is the join key
 * back to the canonical tenant boundary.
 *
 * Note on PK types: `persons.id` and `person_links.id` are `uuid` so
 * the federated identity primitives stand outside BN's `text` tenant-PK
 * convention. `person_links.tenant_id` references `tenants.id` (text)
 * logically — there is intentionally NO FK because we keep the person
 * row alive when a single tenancy is deleted (audit replay).
 */

import {
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================================
// persons — canonical human identity (one row per real human)
// ============================================================================

export const persons = pgTable(
  'persons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * ITU-T E.164 phone, leading '+' included. Deterministic identity-
     * resolution primary signal — every onboarding flow (customer-app,
     * estate-manager-app, owner-portal, marketing CTAs) captures this.
     */
    primaryPhoneE164: text('primary_phone_e164').notNull().unique(),
    primaryEmail: text('primary_email'),
    displayName: text('display_name').notNull(),
    /**
     * ISO-639-1 (sw|en|fr|...). Default `en` per CLAUDE.md
     * "English default · bilingual sw/en" (flipped 2026-05). Tanzanian
     * users can opt into `sw` from the settings panel; toggle is
     * absolute (no language mixing in renders).
     */
    preferredLanguage: text('preferred_language').notNull().default('en'),
    /**
     * Affirmative opt-in timestamp for cross-tenant federation.
     * NULL means the person has NOT opted in; tenant memories remain
     * fully siloed. Set when the user confirms the multi-tenancy
     * onboarding modal.
     */
    consentUnifiedKbAt: timestamp('consent_unified_kb_at', {
      withTimezone: true,
    }),
    /**
     * Revocation timestamp. Set on one-click un-link; the GDPR redaction
     * pipeline deletes role-private personal-memory cells but keeps the
     * person row as an audit shell.
     */
    consentUnifiedKbRevokedAt: timestamp('consent_unified_kb_revoked_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Hash-chained audit-trail link (mirrors workforce_invitations). */
    hashChainId: uuid('hash_chain_id'),
  },
  (t) => ({
    phoneIdx: index('persons_phone_idx').on(t.primaryPhoneE164),
  }),
);

export type PersonRow = typeof persons.$inferSelect;
export type PersonInsert = typeof persons.$inferInsert;

// ============================================================================
// person_links — (person × tenant × supabase_user) join. Many hats per human.
// ============================================================================

export const personLinks = pgTable(
  'person_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    /**
     * `tenants.id` is text in BN — kept as a logical join (no FK) so a
     * tenancy delete does not cascade and erase the person's other hats.
     */
    tenantId: text('tenant_id').notNull(),
    /** Supabase auth.users.id for this hat. */
    supabaseUserId: text('supabase_user_id').notNull(),
    /**
     * landlord|estate_manager|accountant|maintenance_lead|renter|admin.
     * Free-form text so new role types ship without a migration.
     */
    roleInTenant: text('role_in_tenant').notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set on un-link; the row is kept for audit replay. */
    unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
    /** phone-match|manual|sso|sso-merge|tenant-onboarding. */
    linkMethod: text('link_method').notNull().default('phone-match'),
  },
  (t) => ({
    personIdx: index('person_links_person_idx').on(t.personId),
    tenantUserIdx: index('person_links_tenant_user_idx').on(
      t.tenantId,
      t.supabaseUserId,
    ),
    /**
     * One (person, tenant, supabase_user) triple per row. A human cannot
     * be linked to the same tenant twice under the same auth principal.
     */
    personTenantUserUnique: uniqueIndex(
      'person_links_person_tenant_user_uniq',
    ).on(t.personId, t.tenantId, t.supabaseUserId),
  }),
);

export type PersonLinkRow = typeof personLinks.$inferSelect;
export type PersonLinkInsert = typeof personLinks.$inferInsert;
