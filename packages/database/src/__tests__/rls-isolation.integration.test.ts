/**
 * RLS Option A — REAL cross-tenant isolation proof (live Postgres).
 *
 * This is the end-to-end enforcement test for "RLS Option A": it proves
 * that, when the gateway connects as a NON-BYPASS role and binds the
 * tenant GUC inside a transaction (the `withTenantContext` contract the
 * `databaseMiddleware` now uses), a SELECT on a tenant-scoped table
 * returns ONLY the bound tenant's rows — even though rows for another
 * tenant physically exist in the same table.
 *
 * Why a dedicated role
 * ────────────────────
 * RLS only ENFORCES for roles WITHOUT the BYPASSRLS attribute. The CI
 * Postgres gate (`.github/workflows/integration-tests.yml`) connects as
 * the `bossnyumba` superuser, which bypasses RLS. So this test creates
 * its own NON-BYPASS login-less role (`rls_isolation_test`), grants it
 * the privileges it needs on the tables under test, then `SET LOCAL
 * ROLE`s to it inside the read transaction. That is the closest faithful
 * model of the production NON-BYPASS `app_authenticated` posture.
 *
 * Why `properties`
 * ────────────────
 * `properties` is in the canonical tenant_tables RLS array (migration
 * 0155) and carries the gold-standard `tenant_isolation_select` policy
 * `tenant_id = public.current_app_tenant_id()` scoped `TO authenticated`.
 * It is FORCE ROW LEVEL SECURITY, so even the table owner is filtered.
 *
 * Seeding bypass
 * ──────────────
 * Seeding two tenants' rows would itself be blocked by the
 * `tenant_isolation_modify` WITH CHECK if we ran as a tenant. We seed via
 * `withServiceRoleContext` (binds `app.is_service_role='true'`, which the
 * 0179b `service_role_bypass` policy honours) AND as the superuser, so
 * the fixtures land regardless of policy phase.
 *
 * Skipped unless DATABASE_URL is set — runs for real in the CI Postgres
 * gate alongside the other `skipIf(!DATABASE_URL)` integration suites.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { sql } from 'drizzle-orm';
import { createDatabaseClient } from '../client.js';
import { withTenantContext, withServiceRoleContext } from '../rls/index.js';

const DATABASE_URL = process.env.DATABASE_URL;
const RUN = Boolean(DATABASE_URL);

// A NON-BYPASS role created for the duration of the test. NOLOGIN +
// NOBYPASSRLS so RLS policies actually apply when we SET ROLE to it.
const TEST_ROLE = 'rls_isolation_test';

describe.skipIf(!RUN)('RLS cross-tenant isolation (real Postgres, non-BYPASS role)', () => {
  let db: ReturnType<typeof createDatabaseClient>;

  const tenantA = `rls-a-${uuid()}`;
  const tenantB = `rls-b-${uuid()}`;
  const ownerA = `rls-owner-a-${uuid()}`;
  const ownerB = `rls-owner-b-${uuid()}`;
  const propertyA = `rls-prop-a-${uuid()}`;
  const propertyB = `rls-prop-b-${uuid()}`;

  beforeAll(async () => {
    db = createDatabaseClient(DATABASE_URL!);

    // 1) Create the NON-BYPASS test role + grant it the privileges it
    //    needs on the tables under test. Idempotent so re-runs are safe.
    // NOTE: TEST_ROLE is inlined as a SQL string literal via sql.raw (it is a
    // hardcoded constant, not user input). A bound param ($1) cannot be used
    // inside a DO $$ ... $$ block body — Postgres raises 42P18.
    await db.execute(sql.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${TEST_ROLE}') THEN
          EXECUTE format('CREATE ROLE %I NOLOGIN NOBYPASSRLS', '${TEST_ROLE}');
        END IF;
      END
      $$;
    `));
    // The 0155 RLS policies are scoped `TO authenticated`; make our test
    // role a member of `authenticated` (when that role exists — it is
    // seeded in the CI Postgres gate) so those policies apply to it. The
    // 0001 `properties_tenant_isolation` policy applies to PUBLIC anyway,
    // so isolation holds even if this membership grant is skipped — but we
    // add it to faithfully mirror the production `authenticated` posture.
    await db.execute(sql.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          EXECUTE format('GRANT authenticated TO %I', '${TEST_ROLE}');
        END IF;
      END
      $$;
    `));
    // RLS runs AFTER the privilege check, so the role needs table grants
    // for the SELECT to reach the policy layer at all.
    await db.execute(sql`GRANT SELECT, INSERT ON public.properties TO ${sql.raw(TEST_ROLE)}`);
    await db.execute(sql`GRANT SELECT, INSERT ON public.tenants TO ${sql.raw(TEST_ROLE)}`);
    await db.execute(sql`GRANT SELECT, INSERT ON public.users TO ${sql.raw(TEST_ROLE)}`);

    // 2) Seed two tenants, each with an owner user + one property. Done
    //    under service-role context so the WITH CHECK policies do not
    //    block the cross-tenant fixture insert.
    await withServiceRoleContext(db, async (tx) => {
      for (const [tenantId, ownerId, propertyId, suffix] of [
        [tenantA, ownerA, propertyA, 'a'],
        [tenantB, ownerB, propertyB, 'b'],
      ] as const) {
        await tx.execute(sql`
          INSERT INTO public.tenants (id, name, slug, status, subscription_tier, primary_email)
          VALUES (${tenantId}, ${'RLS Test ' + suffix}, ${tenantId}, 'active', 'starter', ${suffix + '@rls.test'})
          ON CONFLICT (id) DO NOTHING
        `);
        await tx.execute(sql`
          INSERT INTO public.users (id, tenant_id, email, first_name, last_name, status)
          VALUES (${ownerId}, ${tenantId}, ${'owner-' + suffix + '@rls.test'}, 'Owner', ${suffix.toUpperCase()}, 'active')
          ON CONFLICT (id) DO NOTHING
        `);
        await tx.execute(sql`
          INSERT INTO public.properties
            (id, tenant_id, owner_id, property_code, name, type, status,
             address_line1, city, country, default_currency)
          VALUES
            (${propertyId}, ${tenantId}, ${ownerId}, ${'PC-' + suffix}, ${'Prop ' + suffix},
             'single_family', 'active', '1 Test St', 'Dar es Salaam', 'TZ', 'TZS')
          ON CONFLICT (id) DO NOTHING
        `);
      }
    });
  });

  afterAll(async () => {
    if (!db) return;
    // Clean up fixtures (service-role to bypass policy on delete) + the
    // test role. Property/user rows cascade from the tenant delete.
    await withServiceRoleContext(db, async (tx) => {
      await tx.execute(sql`DELETE FROM public.tenants WHERE id IN (${tenantA}, ${tenantB})`);
    });
    // Revoke + drop the role so the next run starts clean. REVOKE first
    // (DROP ROLE fails while privileges are still granted).
    try {
      await db.execute(sql`REVOKE ALL ON public.properties FROM ${sql.raw(TEST_ROLE)}`);
      await db.execute(sql`REVOKE ALL ON public.tenants FROM ${sql.raw(TEST_ROLE)}`);
      await db.execute(sql`REVOKE ALL ON public.users FROM ${sql.raw(TEST_ROLE)}`);
      await db.execute(sql`REVOKE authenticated FROM ${sql.raw(TEST_ROLE)}`);
      await db.execute(sql`DROP ROLE IF EXISTS ${sql.raw(TEST_ROLE)}`);
    } catch {
      // Best-effort teardown — leaving the role behind is harmless and the
      // CREATE is idempotent on the next run.
    }
  });

  it('binds tenant A and sees ONLY tenant A rows (zero of tenant B)', async () => {
    // Read inside ONE transaction as the NON-BYPASS role with tenant A's
    // GUC bound (SET LOCAL). This mirrors exactly what the gateway
    // databaseMiddleware does per request.
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE ${sql.raw(TEST_ROLE)}`);
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantA}, true)`);
      const result = (await tx.execute(
        sql`SELECT id, tenant_id FROM public.properties
            WHERE id IN (${propertyA}, ${propertyB})`,
      )) as unknown as ReadonlyArray<{ id: string; tenant_id: string }> | { rows?: unknown[] };
      // postgres-js returns the row array directly; normalise just in case
      // a driver wraps it in `{ rows }`.
      const list = Array.isArray(result)
        ? result
        : ((result as { rows?: unknown[] }).rows ?? []);
      // RESET ROLE before the tx ends so the pooled connection is clean.
      await tx.execute(sql`RESET ROLE`);
      return list as ReadonlyArray<{ id: string; tenant_id: string }>;
    });

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(propertyA);
    expect(ids).not.toContain(propertyB);
    expect(rows.every((r) => r.tenant_id === tenantA)).toBe(true);
  });

  it('binding tenant B sees ONLY tenant B rows (proves the filter tracks the GUC)', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE ${sql.raw(TEST_ROLE)}`);
      await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantB}, true)`);
      const result = (await tx.execute(
        sql`SELECT id, tenant_id FROM public.properties
            WHERE id IN (${propertyA}, ${propertyB})`,
      )) as unknown as ReadonlyArray<{ id: string; tenant_id: string }> | { rows?: unknown[] };
      const list = Array.isArray(result)
        ? result
        : ((result as { rows?: unknown[] }).rows ?? []);
      await tx.execute(sql`RESET ROLE`);
      return list as ReadonlyArray<{ id: string; tenant_id: string }>;
    });

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(propertyB);
    expect(ids).not.toContain(propertyA);
  });

  it('with NO tenant GUC bound, the non-BYPASS role sees ZERO rows (fail-closed)', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE ${sql.raw(TEST_ROLE)}`);
      // Deliberately do NOT bind app.current_tenant_id. The helper returns
      // NULL, the predicate `tenant_id = NULL` is never true, RLS denies.
      const result = (await tx.execute(
        sql`SELECT id FROM public.properties WHERE id IN (${propertyA}, ${propertyB})`,
      )) as unknown as ReadonlyArray<{ id: string }> | { rows?: unknown[] };
      const list = Array.isArray(result)
        ? result
        : ((result as { rows?: unknown[] }).rows ?? []);
      await tx.execute(sql`RESET ROLE`);
      return list as ReadonlyArray<{ id: string }>;
    });
    expect(rows).toHaveLength(0);
  });

  it('superuser (BYPASSRLS) sees BOTH rows — confirming the test fixtures exist and proving the role distinction', async () => {
    // Sanity check: the SAME query as the superuser (which the CI gate
    // connects as) returns both rows. This proves (a) the fixtures are
    // really there, so the zero-rows results above are RLS filtering and
    // not missing data, and (b) the enforcement difference is entirely
    // due to the BYPASSRLS attribute of the connecting role.
    const result = (await db.execute(
      sql`SELECT id FROM public.properties WHERE id IN (${propertyA}, ${propertyB})`,
    )) as unknown as ReadonlyArray<{ id: string }> | { rows?: unknown[] };
    const list = Array.isArray(result)
      ? result
      : ((result as { rows?: unknown[] }).rows ?? []);
    const ids = (list as ReadonlyArray<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(propertyA);
    expect(ids).toContain(propertyB);
  });
});
