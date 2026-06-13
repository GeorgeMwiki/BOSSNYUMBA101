#!/usr/bin/env node
/**
 * seed-six-orgs.mjs — provision SIX organizations (tenants) and, for EACH
 * org, TWO linked test users on the REAL data path, idempotently:
 *
 *   - WORKER   — a workforce member of the org. Created as a REAL Supabase
 *                auth user (Admin API, server-managed app_metadata.tenant_id),
 *                mirrored into the app `users` table, AND linked to the org as
 *                a REAL workforce row in `staff_members` (the ORG-ADMIN-TOOLS
 *                staff lifecycle table). This is the on-the-ground operator.
 *
 *   - CUSTOMER — the real-estate COUNTERPARTY (renter / tenant-of-property),
 *                an EXTERNAL party — NOT a tenant-insider. Created as a REAL
 *                Supabase auth user (so they can log into the customer portal),
 *                mirrored into app `users`, AND linked to the org as a REAL
 *                `customers` row (the counterparty/customer linkage table).
 *
 *   6 orgs × 2 users = 12 login users.
 *
 * Each org is also seeded with a REAL PRODUCT CATALOG — the org marketplace
 * (`marketplace_listings`). A listing requires a real `unit_id`, so per org we
 * also create one REAL property + a few REAL units, then publish listings over
 * them. The product currency is RESOLVED FROM THE TENANT (its jurisdictional
 * default, recorded in tenant.settings.currency + a `currency_preferences`
 * tenant row at tenant-creation, then read back) — NO hard-coded currency
 * literal lives in the product path (CLAUDE.md multi-currency hard rule).
 *
 * ZERO transactional data: no leases, payments, invoices, maintenance, bids.
 *
 * Everything is idempotent — re-runs converge (find-first / ON CONFLICT) and
 * exit 0 with `(exists)` annotations.
 *
 * ---------------------------------------------------------------------------
 * Tenant-id shape
 * ---------------------------------------------------------------------------
 * `tenants.id` is TEXT, but the `staff_members` workforce table (migration
 * 0305) declares `tenant_id uuid`. To make the WORKER a real `staff_members`
 * row while keeping ONE tenant id usable everywhere (tenants.id text,
 * staff_members.tenant_id uuid, Supabase app_metadata.tenant_id, and the
 * gateway TENANT_ID_REGEX /^[a-zA-Z0-9_-]{1,64}$/ which accepts UUIDs), each
 * org's tenant id is a DETERMINISTIC UUID derived from its stable slug
 * (org-01 .. org-06). Deterministic → re-runs resolve the same tenant.
 *
 * ---------------------------------------------------------------------------
 * Required environment (read from .env.local — same loader as the other seeds)
 * ---------------------------------------------------------------------------
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     → server-only key, NEVER ship to client
 *   DATABASE_URL                  → Postgres connection (session-mode pooler)
 *
 * Optional:
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY → if present, each user's login is verified
 *   BOSSNYUMBA_ORG_COUNT          → override 6 (default 6)
 *   BOSSNYUMBA_SEED_PASSWORD      → override the shared test password
 *   BOSSNYUMBA_SEED_COUNTRY       → ISO-3166-1 alpha-2 each org launches in
 *                                   (default 'TZ' — the launch jurisdiction).
 *                                   Drives currency via jurisdictional rules.
 *
 * Exit codes:
 *   0 — converged (seeded or already present)
 *   1 — fatal error (network / auth / SQL)
 *   2 — missing required env var
 *
 * Safety: refuses to run when SUPABASE_URL pattern-matches production.
 */

import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Currency resolution helper — loaded from the BUILT domain-models dist via a
// relative URL (the workspace package is NOT symlinked into node_modules for a
// standalone `node scripts/…` run, so a bare-specifier import would fail).
// getDefaultCurrency(country) returns the jurisdictional default (TZ→TZS,
// KE→KES, NG→NGN). If dist is unbuilt, currency falls back to the DB's
// platform-default currency_preferences row (resolved per tenant) — we never
// hard-code a jurisdiction currency literal into the product path.
// ---------------------------------------------------------------------------

let _getDefaultCurrency = null;
async function loadCurrencyHelper() {
  if (_getDefaultCurrency !== null) return _getDefaultCurrency;
  try {
    const distUrl = new URL('../packages/domain-models/dist/index.mjs', import.meta.url);
    const mod = await import(distUrl.href);
    _getDefaultCurrency = typeof mod.getDefaultCurrency === 'function' ? mod.getDefaultCurrency : false;
  } catch {
    _getDefaultCurrency = false; // dist unbuilt → DB platform-default fallback
  }
  return _getDefaultCurrency;
}

// ---------------------------------------------------------------------------
// 1. Env loading — identical pattern to seed-live-test-users / seed-trc-tenant.
// ---------------------------------------------------------------------------

function loadDotEnvLocal() {
  const file = path.join(__dirname, '..', '.env.local');
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return; // .env.local missing → fall back to process.env
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    const [, key, valRaw] = m;
    if (process.env[key]) continue; // don't clobber actual env
    const val = valRaw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    process.env[key] = val;
  }
}
loadDotEnvLocal();

function required(name) {
  const v = process.env[name];
  if (!v || /^TODO_/.test(v)) {
    console.error(`[seed-six-orgs] missing required env: ${name}`);
    process.exit(2);
  }
  return v;
}

function requiredOneOf(names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && !/^TODO_/.test(v)) return v;
  }
  console.error(`[seed-six-orgs] missing required env (one of): ${names.join(', ')}`);
  process.exit(2);
}

const oneOf = (names) => names.map((n) => process.env[n]).find((v) => v && !/^TODO_/.test(v));

const SUPABASE_URL = requiredOneOf(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']).replace(/\/+$/, '');
const SERVICE_ROLE = required('SUPABASE_SERVICE_ROLE_KEY');
const DATABASE_URL = required('DATABASE_URL');
const ANON_KEY = oneOf(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY']); // optional

const ORG_COUNT = Number(process.env.BOSSNYUMBA_ORG_COUNT ?? '6');
const PASSWORD = process.env.BOSSNYUMBA_SEED_PASSWORD ?? 'SixOrgs!Secure-2026';
// Launch jurisdiction each seeded org operates in. Drives the tenant's
// currency via getDefaultCurrency — never hard-coded into the product path.
const SEED_COUNTRY = (process.env.BOSSNYUMBA_SEED_COUNTRY ?? 'TZ').toUpperCase();

function assertNotProduction() {
  if (/prod|production|live/i.test(SUPABASE_URL)) {
    console.error(
      `[seed-six-orgs] REFUSING to run — SUPABASE_URL looks like production: ${SUPABASE_URL}`,
    );
    process.exit(1);
  }
}
assertNotProduction();

// ---------------------------------------------------------------------------
// 2. Deterministic tenant-id (UUID) derivation from a stable slug.
//    A v5-style namespaced UUID: SHA-1(slug) folded into the UUID layout so
//    every run produces the SAME id for the SAME slug (idempotency anchor).
// ---------------------------------------------------------------------------

const TENANT_ID_NAMESPACE = 'bossnyumba.seed-six-orgs.v1';

function deterministicTenantUuid(slug) {
  const h = createHash('sha1').update(`${TENANT_ID_NAMESPACE}:${slug}`).digest('hex');
  // Layout: 8-4-4-4-12. Set version nibble to 5 and the RFC-4122 variant bits.
  const variant = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `5${h.slice(13, 16)}`,
    `${variant}${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

// ---------------------------------------------------------------------------
// 3. The six orgs. Stable slugs org-01 .. org-06 → deterministic tenant ids.
//    Each org gets a small, REAL product catalog (units → listings). The
//    listing prices are minor units; the CURRENCY is filled in at runtime
//    from the tenant's resolved currency (NOT hard-coded here).
// ---------------------------------------------------------------------------

function buildOrgs(count) {
  const orgs = [];
  for (let i = 1; i <= count; i += 1) {
    const n = String(i).padStart(2, '0');
    const slug = `org-${n}`;
    const tenantId = deterministicTenantUuid(slug);
    orgs.push({
      index: i,
      slug,
      tenantId,
      name: `Seed Org ${n}`,
      primaryEmail: `org${n}.worker@bossnyumba.test`,
      // The two REQUIRED login users for this org.
      worker: {
        email: `org${n}.worker@bossnyumba.test`,
        firstName: `Org${n}`,
        lastName: 'Worker',
        // Workforce roles → MAINTENANCE_STAFF maps onto the gateway UserRole.
        roles: ['MAINTENANCE_STAFF', 'worker', 'employee'],
        staffRole: 'caretaker', // free-form staff_members.role label
      },
      customer: {
        email: `org${n}.customer@bossnyumba.test`,
        firstName: `Org${n}`,
        lastName: 'Customer',
        // Counterparty (renter) role → RESIDENT maps onto the gateway UserRole.
        roles: ['RESIDENT', 'customer'],
      },
      // REAL property + units that back the org product catalog.
      property: {
        id: `prop_${slug.replace(/-/g, '_')}_main`,
        code: `${slug.toUpperCase()}-P1`,
        name: `Seed Org ${n} — Riverside Court`,
        type: 'apartment_complex',
        city: 'Dar es Salaam',
        address: `Plot ${i}0, Seed Avenue`,
      },
      // Product catalog: each unit becomes one published marketplace listing.
      // Prices are MINOR UNITS (e.g. cents). Currency resolved at runtime.
      units: [
        { code: 'A-101', name: 'Unit A-101 (Studio)', type: 'studio', rent: 280_000_00, listingKind: 'rent' },
        { code: 'A-102', name: 'Unit A-102 (1-Bed)', type: 'one_bedroom', rent: 420_000_00, listingKind: 'rent' },
        { code: 'B-201', name: 'Unit B-201 (2-Bed)', type: 'two_bedroom', rent: 650_000_00, listingKind: 'rent' },
        { code: 'C-001', name: 'Shop C-001 (Retail)', type: 'commercial_retail', rent: 900_000_00, listingKind: 'lease' },
      ],
    });
  }
  return orgs;
}

const ORGS = buildOrgs(ORG_COUNT);

// ---------------------------------------------------------------------------
// 4. Supabase Admin API helpers — exact pattern from the proven seeds.
// ---------------------------------------------------------------------------

async function adminApi(pathSuffix, init = {}) {
  const url = `${SUPABASE_URL}${pathSuffix}`;
  const headers = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

// Cache the full user list once — the seed set is small and the list endpoint
// has no server-side email filter.
let _allUsers = null;
async function findUserByEmail(email) {
  if (!_allUsers) {
    const { ok, body, status } = await adminApi('/auth/v1/admin/users?page=1&per_page=4000');
    if (!ok) throw new Error(`list users failed (${status}): ${JSON.stringify(body)}`);
    _allUsers = Array.isArray(body?.users) ? body.users : [];
  }
  return _allUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function createOrUpdateSupabaseUser({ email, firstName, lastName, roles }, tenantId) {
  const payload = {
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: {
      // SERVER-MANAGED — verifySupabaseJwt trusts only app_metadata.tenant_id
      // (F6 hardening rejects tenant_id sourced from user_metadata).
      tenant_id: tenantId,
      roles,
      environment: 'development',
      seed: 'six-orgs',
    },
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      // NEVER put tenant_id here.
    },
  };
  const existing = await findUserByEmail(email);
  if (existing) {
    const { ok, body, status } = await adminApi(
      `/auth/v1/admin/users/${encodeURIComponent(existing.id)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (!ok) throw new Error(`update user ${email} failed (${status}): ${JSON.stringify(body)}`);
    return { id: existing.id, alreadyExisted: true };
  }
  const { ok, body, status } = await adminApi('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!ok) throw new Error(`create user ${email} failed (${status}): ${JSON.stringify(body)}`);
  return { id: body?.id ?? body?.user?.id, alreadyExisted: false };
}

async function verifyLogin(email) {
  if (!ANON_KEY) return null; // verification optional — skip if no anon key
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  return res.ok && !!body?.access_token;
}

// ---------------------------------------------------------------------------
// 5. SQL helpers — every step is a guarded find-first / ON CONFLICT insert.
// ---------------------------------------------------------------------------

/**
 * Resolve the launch currency for the seeded orgs WITHOUT a hard-coded literal:
 *   1) the jurisdictional default for SEED_COUNTRY (domain-models dist), else
 *   2) the DB platform-default currency_preferences row (scope='platform-default').
 * Throws if neither is available rather than silently pinning a currency.
 */
async function resolveLaunchCurrency(tx) {
  const getDefaultCurrency = await loadCurrencyHelper();
  if (getDefaultCurrency) {
    const c = getDefaultCurrency(SEED_COUNTRY);
    if (c) return c;
  }
  const platform = await tx`
    SELECT currency FROM currency_preferences
     WHERE scope_kind = 'platform-default' LIMIT 1
  `;
  if (platform.length && platform[0].currency) return platform[0].currency;
  throw new Error(
    '[seed-six-orgs] cannot resolve a currency: build packages/domain-models ' +
    '(pnpm --filter @bossnyumba/domain-models build) or seed the platform-default ' +
    'currency_preferences row first. Refusing to hard-code a jurisdiction currency.',
  );
}

/**
 * Ensure the tenant row + its currency preference. The currency is resolved
 * ONCE via resolveLaunchCurrency (jurisdiction default or DB platform-default)
 * and recorded on the tenant (settings.currency) and as a `currency_preferences`
 * tenant-scope row. Returns the resolved currency so the product path reads
 * it back from the TENANT rather than hard-coding any literal.
 */
async function ensureTenant(tx, org) {
  const currency = await resolveLaunchCurrency(tx); // jurisdiction default or DB platform-default
  const settings = {
    currency,
    country: SEED_COUNTRY,
    seed: 'six-orgs',
  };

  const existing = await tx`
    SELECT id, settings FROM tenants WHERE slug = ${org.slug} AND deleted_at IS NULL LIMIT 1
  `;
  let tenantId = existing.length ? existing[0].id : org.tenantId;
  let alreadyExisted = existing.length > 0;

  if (!existing.length) {
    await tx`
      INSERT INTO tenants (
        id, name, slug, status, primary_email, country, settings,
        max_users, max_properties, max_units,
        created_at, updated_at, created_by
      ) VALUES (
        ${org.tenantId}, ${org.name}, ${org.slug}, 'active', ${org.primaryEmail},
        ${SEED_COUNTRY}, ${JSON.stringify(settings)}::jsonb,
        50, 50, 500,
        NOW(), NOW(), 'seed-six-orgs'
      )
      ON CONFLICT (slug) DO NOTHING
    `;
    // Re-read to capture the authoritative id (in case of a concurrent run).
    const after = await tx`
      SELECT id FROM tenants WHERE slug = ${org.slug} AND deleted_at IS NULL LIMIT 1
    `;
    tenantId = after.length ? after[0].id : org.tenantId;
  }

  // Tenant-scope currency preference (resolution chain: user → tenant → platform).
  await tx`
    INSERT INTO currency_preferences (scope_kind, scope_id, currency, source, updated_at)
    VALUES ('tenant', ${tenantId}, ${currency}, 'seed', NOW())
    ON CONFLICT (scope_kind, scope_id)
    DO UPDATE SET currency = EXCLUDED.currency, source = 'seed', updated_at = NOW()
  `;

  return { tenantId, currency, alreadyExisted };
}

/** Resolve the tenant's display currency back FROM the tenant (no literals). */
async function resolveTenantCurrency(tx, tenantId, fallback) {
  const pref = await tx`
    SELECT currency FROM currency_preferences
     WHERE scope_kind = 'tenant' AND scope_id = ${tenantId} LIMIT 1
  `;
  if (pref.length && pref[0].currency) return pref[0].currency;
  const t = await tx`SELECT settings FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  const fromSettings = t.length ? t[0].settings?.currency : undefined;
  return fromSettings ?? fallback;
}

/** Mirror a Supabase user into the app `users` table (idempotent by email). */
async function ensureAppUser(tx, tenantId, user, { isOwner }) {
  const existing = await tx`
    SELECT id FROM users
     WHERE tenant_id = ${tenantId} AND email = ${user.email} AND deleted_at IS NULL
     LIMIT 1
  `;
  if (existing.length) {
    return { appUserId: existing[0].id, alreadyExisted: true };
  }
  const appUserId = `usr_${randomUUID()}`;
  await tx`
    INSERT INTO users (
      id, tenant_id, email, phone, first_name, last_name,
      status, is_owner, timezone, locale,
      created_at, updated_at, created_by
    ) VALUES (
      ${appUserId}, ${tenantId}, ${user.email}, NULL, ${user.firstName}, ${user.lastName},
      'active', ${isOwner}, 'Africa/Dar_es_Salaam', 'en',
      NOW(), NOW(), 'seed-six-orgs'
    )
    ON CONFLICT DO NOTHING
  `;
  return { appUserId, alreadyExisted: false };
}

/**
 * Link the WORKER as a REAL workforce member of the org via `staff_members`.
 * tenant_id is uuid here (migration 0305) — our tenant id IS a uuid.
 * Idempotent by the (tenant_id, lower(full_name)) active-name unique index.
 */
async function ensureWorkforceMember(tx, tenantId, worker) {
  const fullName = `${worker.firstName} ${worker.lastName}`;
  const existing = await tx`
    SELECT id FROM staff_members
     WHERE tenant_id = ${tenantId}::uuid AND lower(full_name) = lower(${fullName})
       AND status <> 'terminated'
     LIMIT 1
  `;
  if (existing.length) {
    return { staffMemberId: existing[0].id, alreadyExisted: true };
  }
  const rows = await tx`
    INSERT INTO staff_members (
      tenant_id, full_name, role, status, metadata, provenance
    ) VALUES (
      ${tenantId}::uuid, ${fullName}, ${worker.staffRole}, 'active',
      ${JSON.stringify({ email: worker.email, seededLoginUser: true })}::jsonb,
      ${JSON.stringify({ via: 'seed-six-orgs' })}::jsonb
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  return { staffMemberId: rows.length ? rows[0].id : null, alreadyExisted: false };
}

/**
 * Link the CUSTOMER as a REAL counterparty of the org via `customers`.
 * This is the EXTERNAL renter/tenant-of-property — NOT a tenant-insider.
 * Idempotent by the (tenant_id, email) unique index.
 */
async function ensureCounterparty(tx, tenantId, customer) {
  const existing = await tx`
    SELECT id FROM customers
     WHERE tenant_id = ${tenantId} AND email = ${customer.email} AND deleted_at IS NULL
     LIMIT 1
  `;
  if (existing.length) {
    return { customerId: existing[0].id, alreadyExisted: true };
  }
  const customerId = `cust_${randomUUID()}`;
  const customerCode = `CUST-${customer.email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
  // Phone is NOT NULL on customers — a stable, deterministic placeholder.
  const phone = `+2557${String(Math.abs(hashInt(customer.email))).padStart(8, '0').slice(0, 8)}`;
  await tx`
    INSERT INTO customers (
      id, tenant_id, customer_code, email, phone,
      first_name, last_name, status, kyc_status,
      portal_access_enabled, preferred_contact_method,
      created_at, updated_at, created_by
    ) VALUES (
      ${customerId}, ${tenantId}, ${customerCode}, ${customer.email}, ${phone},
      ${customer.firstName}, ${customer.lastName}, 'active', 'pending',
      TRUE, 'email',
      NOW(), NOW(), 'seed-six-orgs'
    )
    ON CONFLICT DO NOTHING
  `;
  return { customerId, alreadyExisted: false };
}

function hashInt(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Ensure the org's REAL property (owner_id = the worker's app user id). */
async function ensureProperty(tx, tenantId, org, ownerUserId, currency) {
  const existing = await tx`
    SELECT id FROM properties
     WHERE tenant_id = ${tenantId} AND property_code = ${org.property.code} AND deleted_at IS NULL
     LIMIT 1
  `;
  if (existing.length) {
    return { propertyId: existing[0].id, alreadyExisted: true };
  }
  await tx`
    INSERT INTO properties (
      id, tenant_id, owner_id, property_code, name, type, status, description,
      address_line1, city, country, default_currency, total_units,
      created_at, updated_at, created_by
    ) VALUES (
      ${org.property.id}, ${tenantId}, ${ownerUserId}, ${org.property.code},
      ${org.property.name}, ${org.property.type}, 'active',
      ${`Seed catalog property for ${org.name}`},
      ${org.property.address}, ${org.property.city}, ${SEED_COUNTRY}, ${currency},
      ${org.units.length},
      NOW(), NOW(), 'seed-six-orgs'
    )
    ON CONFLICT DO NOTHING
  `;
  return { propertyId: org.property.id, alreadyExisted: false };
}

/** Ensure the org's REAL units (the inventory the products list over). */
async function ensureUnits(tx, tenantId, org, propertyId, currency) {
  const results = [];
  for (const u of org.units) {
    const unitId = `unit_${org.slug.replace(/-/g, '_')}_${u.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const existing = await tx`
      SELECT id FROM units
       WHERE tenant_id = ${tenantId} AND property_id = ${propertyId} AND unit_code = ${u.code}
         AND deleted_at IS NULL
       LIMIT 1
    `;
    if (existing.length) {
      results.push({ ...u, unitId: existing[0].id, alreadyExisted: true });
      continue;
    }
    await tx`
      INSERT INTO units (
        id, tenant_id, property_id, unit_code, name, type, status,
        base_rent_amount, base_rent_currency,
        created_at, updated_at, created_by
      ) VALUES (
        ${unitId}, ${tenantId}, ${propertyId}, ${u.code}, ${u.name}, ${u.type}, 'vacant',
        ${u.rent}, ${currency},
        NOW(), NOW(), 'seed-six-orgs'
      )
      ON CONFLICT DO NOTHING
    `;
    results.push({ ...u, unitId, alreadyExisted: false });
  }
  return results;
}

/**
 * Ensure the org PRODUCT CATALOG — one published `marketplace_listings` row
 * per unit. The listing currency is the resolved TENANT currency (read back),
 * NOT a hard-coded literal. This is the org product/marketplace catalog with
 * ZERO transactional data (no bids/negotiations).
 */
async function ensureListings(tx, tenantId, org, propertyId, units, currency) {
  const results = [];
  for (const u of units) {
    const listingId = `lst_${org.slug.replace(/-/g, '_')}_${u.code.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const existing = await tx`
      SELECT id FROM marketplace_listings
       WHERE tenant_id = ${tenantId} AND unit_id = ${u.unitId}
       LIMIT 1
    `;
    if (existing.length) {
      results.push({ code: u.code, listingId: existing[0].id, alreadyExisted: true });
      continue;
    }
    await tx`
      INSERT INTO marketplace_listings (
        id, tenant_id, unit_id, property_id, listing_kind,
        headline_price, currency, negotiable, attributes, status,
        published_at, created_at, created_by, updated_at, updated_by
      ) VALUES (
        ${listingId}, ${tenantId}, ${u.unitId}, ${propertyId}, ${u.listingKind},
        ${u.rent}, ${currency}, TRUE,
        ${JSON.stringify({ unitType: u.type, source: 'seed-six-orgs' })}::jsonb,
        'published', NOW(), NOW(), 'seed-six-orgs', NOW(), 'seed-six-orgs'
      )
      ON CONFLICT DO NOTHING
    `;
    results.push({ code: u.code, listingId, alreadyExisted: false });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 6. Main.
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[seed-six-orgs] target Supabase: ${SUPABASE_URL}`);
  console.log(`[seed-six-orgs] orgs: ${ORG_COUNT}  country: ${SEED_COUNTRY}  password: ${PASSWORD}`);
  const ccyHelper = await loadCurrencyHelper();
  console.log(
    `[seed-six-orgs] currency source: ${ccyHelper ? `jurisdiction ${SEED_COUNTRY} → ${ccyHelper(SEED_COUNTRY)}` : 'DB platform-default (domain-models dist unbuilt)'}\n`,
  );

  // Step A — create the Supabase auth users so we know their ids first.
  // (worker + customer per org)
  for (const org of ORGS) {
    for (const [kind, u] of [['worker', org.worker], ['customer', org.customer]]) {
      const { id, alreadyExisted } = await createOrUpdateSupabaseUser(u, org.tenantId);
      u.supabaseUserId = id;
      u.alreadyExisted = alreadyExisted;
      console.log(`  [auth] ${alreadyExisted ? 'exists ' : 'created'}: ${u.email.padEnd(34)} (${kind})  → ${id}`);
    }
  }

  // Step B — mirror + link into the app DB inside one transaction.
  const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });
  const summary = [];
  try {
    await sql.begin(async (tx) => {
      for (const org of ORGS) {
        const { tenantId, currency, alreadyExisted: tenantExisted } = await ensureTenant(tx, org);
        const resolvedCurrency = await resolveTenantCurrency(tx, tenantId, currency);

        // App users (worker is_owner=false; both are normal app users).
        const workerApp = await ensureAppUser(tx, tenantId, org.worker, { isOwner: false });
        const customerApp = await ensureAppUser(tx, tenantId, org.customer, { isOwner: false });

        // WORKER → real workforce member (staff_members).
        const staff = await ensureWorkforceMember(tx, tenantId, org.worker);

        // CUSTOMER → real counterparty (customers).
        const counterparty = await ensureCounterparty(tx, tenantId, org.customer);

        // Product catalog: property → units → listings. owner_id = worker app user.
        const property = await ensureProperty(tx, tenantId, org, workerApp.appUserId, resolvedCurrency);
        const units = await ensureUnits(tx, tenantId, org, property.propertyId, resolvedCurrency);
        const listings = await ensureListings(tx, tenantId, org, property.propertyId, units, resolvedCurrency);

        summary.push({
          org: org.slug,
          tenantId,
          tenantExisted,
          currency: resolvedCurrency,
          worker: { email: org.worker.email, appUserId: workerApp.appUserId, staffMemberId: staff.staffMemberId, supabaseUserId: org.worker.supabaseUserId },
          customer: { email: org.customer.email, appUserId: customerApp.appUserId, customerId: counterparty.customerId, supabaseUserId: org.customer.supabaseUserId },
          products: listings.length,
          newProducts: listings.filter((l) => !l.alreadyExisted).length,
        });

        console.log(
          `  [org] ${tenantExisted ? 'exists ' : 'created'}: ${org.slug} (tenant=${tenantId}, ${resolvedCurrency}) ` +
          `worker+customer linked, ${listings.length} products (${listings.filter((l) => !l.alreadyExisted).length} new)`,
        );
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  // Step C — verify logins (optional, if anon key present).
  if (ANON_KEY) {
    console.log('\nLogin verification:');
    let ok = 0;
    let total = 0;
    for (const org of ORGS) {
      for (const u of [org.worker, org.customer]) {
        total += 1;
        const pass = await verifyLogin(u.email);
        if (pass) ok += 1; else console.log(`  ✗ ${u.email}`);
      }
    }
    console.log(`  ${ok}/${total} users logged in ✓`);
  } else {
    console.log('\n(login verification skipped — set NEXT_PUBLIC_SUPABASE_ANON_KEY to enable)');
  }

  // Step D — summary table + login commands.
  console.log('\n========================================================================');
  console.log('[seed-six-orgs] CONVERGED — 6 orgs × (1 worker + 1 customer) + products');
  console.log('========================================================================');
  for (const s of summary) {
    console.log(
      `${s.org}  tenant=${s.tenantId}  ${s.currency}  products=${s.products}\n` +
      `   worker   ${s.worker.email.padEnd(34)} staff_member=${s.worker.staffMemberId ?? '(exists)'}\n` +
      `   customer ${s.customer.email.padEnd(34)} customer=${s.customer.customerId}`,
    );
  }

  const firstWorker = ORGS[0].worker.email;
  const firstCustomer = ORGS[0].customer.email;
  console.log('\nLogin example (worker of org-01):');
  console.log(`  curl -X POST ${SUPABASE_URL}/auth/v1/token?grant_type=password \\`);
  console.log(`    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \\`);
  console.log(`    -H 'Content-Type: application/json' \\`);
  console.log(`    -d '{"email":"${firstWorker}","password":"${PASSWORD}"}'`);
  console.log('\nLogin example (customer of org-01):');
  console.log(`  curl -X POST ${SUPABASE_URL}/auth/v1/token?grant_type=password \\`);
  console.log(`    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \\`);
  console.log(`    -H 'Content-Type: application/json' \\`);
  console.log(`    -d '{"email":"${firstCustomer}","password":"${PASSWORD}"}'`);
  console.log('\nThen call any gateway-authed route with the returned access_token.');
}

main().catch((err) => {
  console.error('[seed-six-orgs] FAILED:', err?.stack || err);
  process.exit(1);
});
