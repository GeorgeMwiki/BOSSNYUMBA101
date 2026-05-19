/**
 * RLS-coverage allow-list.
 *
 * Drizzle pgTable declarations whose schema carries `tenant_id` (or an
 * equivalent tenant-scoping column) but are intentionally exempt from
 * the `ENABLE ROW LEVEL SECURITY` + tenant policy requirement.
 *
 * Architectural exemptions (NON-tracked-gap categories):
 *   1. Platform-global registries (jurisdictions, countries, currencies).
 *   2. Service-role-only tables (cross-tenant audit aggregates).
 *   3. Tables where `tenant_id` is a scope-hint not an authz boundary.
 *   4. Append-only ledgers where service_role exclusivity is enforced
 *      at the application layer.
 *
 * Keys are the SQL table name (snake_case). Reasons must be ≥ 8 chars
 * and explain the architectural choice.
 *
 * ── am2 drawdown (2026-05-19) ──
 * All 126 pre-Phase-D11 tracked-gap entries that previously lived in
 * this Map have been migrated by 0164_rls_drawdown_batch_1.sql
 * through 0167_rls_drawdown_batch_4.sql. Every tenant-scoped table
 * now has matching ENABLE / FORCE / CREATE POLICY statements in the
 * migration history. The Map is intentionally empty — only
 * architectural-by-design exemptions should be re-added here, and
 * each new entry must cite the exemption category (1-4 above).
 */

export const RLS_ALLOWLIST = new Map([]);
