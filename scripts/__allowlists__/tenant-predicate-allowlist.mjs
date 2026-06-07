/**
 * Tenant-predicate allow-list.
 *
 * Companion to `scripts/audit-tenant-predicate.mjs` (RLS safe-default
 * defense #16, option b).
 *
 * WHY THIS GUARD EXISTS
 * ─────────────────────
 * The production api-gateway connects to Postgres as a role that carries
 * `BYPASSRLS` (Supabase `service_role` convention — see migration
 * 0155_supabase_rls_policies.sql §2). With BYPASSRLS in force the
 * Row-Level-Security policies installed by migrations 0155 / 0156 /
 * 0166 / 0311 are INERT for the gateway connection. Tenant isolation
 * therefore rests SOLELY on app-level `WHERE tenant_id = ?` predicates
 * inside the Drizzle repository layer. A single SELECT/UPDATE/DELETE on
 * a tenant-scoped table that forgets its tenant predicate is a
 * cross-tenant data breach. This audit is the backstop that catches
 * such a missing filter before it ships.
 *
 * WHAT BELONGS HERE
 * ─────────────────
 * Two categories only:
 *
 *   A. ARCHITECTURAL CROSS-TENANT EXEMPTIONS — tables that legitimately
 *      fan out across tenants and are gated by service-role identity +
 *      app-layer authorization rather than a per-statement tenant
 *      predicate. These come straight from migration
 *      0155_supabase_rls_policies.sql §5 ("cross-tenant fan-out tables
 *      intentionally NOT covered"):
 *        cross_tenant_denials, sovereign_action_ledger,
 *        kernel_cot_reservoir, agency_run_checkpoints, sensor_call_log.
 *
 *   B. NON-TENANT SCOPE BOUNDARIES — tables whose primary isolation key
 *      is NOT tenant_id. `persons` / `person_links` /
 *      `personal_memory_cells` are person-scoped (personal knowledge
 *      base, migration 0296). `user_organizations` / `org_join_codes`
 *      are org-scoped marketplace tenancy (migration 0172). Queries on
 *      these scope by person_id / org_id, so a missing `tenant_id =`
 *      predicate is expected and correct.
 *
 * Each key is the SQL table name (snake_case). Each value documents the
 * reason and the migration / audit it traces to. Adding a table here is
 * an auditable accept-the-risk decision — keep reasons specific.
 *
 * NOTE: some of these tables (cross_tenant_denials, persons,
 * person_links, personal_memory_cells, user_organizations,
 * org_join_codes) do not carry a `tenant_id` column at all, so the
 * scanner already treats them as non-tenant tables and never flags
 * them. They are listed here anyway — with `notTenantScoped: true` — so
 * the documented exemption set is complete and self-explanatory, and so
 * the scanner's stale-allowlist check knows not to warn about them.
 */

/**
 * @typedef {Object} TenantPredicateExemption
 * @property {string} reason            Human-readable justification.
 * @property {string} source            Migration / audit the exemption traces to.
 * @property {boolean} [notTenantScoped] True when the table has no tenant_id
 *   column at all (documented for completeness; never flagged regardless).
 */

/** @type {Map<string, TenantPredicateExemption>} */
export const TENANT_PREDICATE_ALLOWLIST = new Map([
  // ─── A. Architectural cross-tenant fan-out (migration 0155 §5) ────────
  [
    'cross_tenant_denials',
    {
      reason:
        'Audit of cross-tenant access ATTEMPTS — by definition spans tenants. ' +
        'Service-role only; no tenant_id boundary. (migration 0155 §5)',
      source: '0155_supabase_rls_policies.sql §5',
      notTenantScoped: true,
    },
  ],
  [
    'sovereign_action_ledger',
    {
      reason:
        'HQ / platform tool executions legitimately span tenants (sovereign ' +
        'actions). Gated by service-role identity + four-eye policy, not a ' +
        'per-statement tenant predicate. (migration 0155 §5, 0129)',
      source: '0155_supabase_rls_policies.sql §5; 0129_sovereign_action_ledger.sql',
    },
  ],
  [
    'kernel_cot_reservoir',
    {
      reason:
        'Chain-of-thought reservoir is intentionally opaque and gated ' +
        'app-side by the kernel; cross-tenant by design. (migration 0155 §5, 0114)',
      source: '0155_supabase_rls_policies.sql §5; 0114_kernel_substrate.sql',
    },
  ],
  [
    'agency_run_checkpoints',
    {
      reason:
        'Agentic workflow checkpoint state; gated app-side by the agency ' +
        'executor. Cross-tenant orchestration. (migration 0155 §5, 0136)',
      source: '0155_supabase_rls_policies.sql §5; 0136_agency_run_checkpoints.sql',
    },
  ],
  [
    'sensor_call_log',
    {
      reason:
        'Sensor routing trace log — trace IDs only, no tenant PII. ' +
        'Cross-tenant observability. (migration 0155 §5, 0126)',
      source: '0155_supabase_rls_policies.sql §5; 0126_sensor_routing_control.sql',
    },
  ],

  // ─── B. Non-tenant scope boundaries (person- / org-scoped) ────────────
  [
    'persons',
    {
      reason:
        'Personal knowledge base — person-scoped (person_id), not ' +
        'tenant-scoped. Isolation key is the person, not the tenant. ' +
        '(migration 0296)',
      source: '0296_personal_knowledge_base.sql',
      notTenantScoped: true,
    },
  ],
  [
    'person_links',
    {
      reason:
        'Personal knowledge base relationship edges — person-scoped, not ' +
        'tenant-scoped. (migration 0296)',
      source: '0296_personal_knowledge_base.sql',
      notTenantScoped: true,
    },
  ],
  [
    'personal_memory_cells',
    {
      reason:
        'Personal memory cells — person-scoped (person_id), not ' +
        'tenant-scoped. (migration 0296)',
      source: '0296_personal_knowledge_base.sql',
      notTenantScoped: true,
    },
  ],
  [
    'user_organizations',
    {
      reason:
        'Marketplace universal tenancy join table — org-scoped (org_id) ' +
        'membership, not tenant-scoped. Queries filter by org_id / user_id. ' +
        '(migration 0172)',
      source: '0172_marketplace_universal_tenancy.sql',
      notTenantScoped: true,
    },
  ],
  [
    'org_join_codes',
    {
      reason:
        'Org invite codes — org-scoped (org_id), not tenant-scoped. ' +
        '(migration 0172)',
      source: '0172_marketplace_universal_tenancy.sql',
      notTenantScoped: true,
    },
  ],
]);

/**
 * Path-level exemptions.
 *
 * Some SURFACES legitimately issue cross-tenant reads on tables that ARE
 * tenant-scoped everywhere else (so the table cannot go in the table-level
 * allowlist above without blinding the gate to every other query on that
 * table). These are HQ / platform-tier aggregation endpoints that the
 * api-gateway only mounts behind the platform-admin authorization guard.
 *
 * A relative path (from repo root) is exempt if it EQUALS an entry or
 * starts with an entry that ends in '/'. Prefer the narrowest possible
 * entry, and prefer an inline `tenant-predicate-allow` comment at the
 * exact call-site over a whole-file path exemption when only one or two
 * queries are cross-tenant.
 *
 * @type {Array<{ path: string, reason: string }>}
 */
export const TENANT_PREDICATE_PATH_ALLOWLIST = [
  {
    path: 'services/api-gateway/src/routes/platform-overview.hono.ts',
    reason:
      'Platform/HQ-tier overview dashboard. Every query here is an ' +
      'intentional cross-tenant aggregate (live user count, units under ' +
      'management, platform monthly revenue). Mounted only behind the ' +
      'platform-admin guard; never reachable by a tenant-scoped session.',
  },
];

/**
 * Inline call-site suppression.
 *
 * Put `tenant-predicate-allow: <why>` in a line comment ON the query line
 * or on one of the up-to-three lines immediately above it to mark a single
 * legitimately-cross-tenant statement. This is the preferred, most precise
 * exemption — it documents the decision exactly where the risk lives and
 * cannot accidentally widen to other queries.
 *
 * Example:
 *   // tenant-predicate-allow: public token resolver, gated by UNIQUE(token)
 *   const [row] = await db.select().from(shareLinks).where(eq(shareLinks.token, token));
 */
export const INLINE_ALLOW_MARKER = 'tenant-predicate-allow';
