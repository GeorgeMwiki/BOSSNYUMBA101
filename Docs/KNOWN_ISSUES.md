# Known Issues

Running log of surfaced bugs that were not fixed inline because they
exceed a ~1-hour scope (cross-package refactors, schema migrations that
need coordinated rollout, infra config, etc.). Each entry includes
precise `file:line`, reproduction steps, root cause, and proposed fix.

Fixes marked inline in `git log` are NOT listed here.

---

## KI-001 — Drizzle migration ledger drift in local dev DB

**Severity:** MEDIUM (local-dev only — CI DB is clean)

**Symptoms.** A GET against `/api/v1/compliance/exports` and a POST to
`/api/v1/risk-reports/{customerId}/generate` returned raw 500 "Internal
Server Error" responses. The Postgres errors are
`relation "compliance_exports" does not exist` and
`relation "tenant_financial_statements" does not exist`, despite the
drizzle migrations table (`drizzle.__drizzle_migrations`) showing those
migrations (0018, 0020, 0021) as applied.

**Reproduction.**
```bash
psql "$DATABASE_URL" -c "SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = '0021_compliance_exports';"
# id | hash -> 34 | 0021_compliance_exports  (applied)

psql "$DATABASE_URL" -c "\dt compliance_exports"
# Did not find any relation named "compliance_exports".
```

**Root cause.** The migrations table records the hash as applied but
the CREATE TABLE statements were somehow never executed (a prior DB
surgery, a partial rollback, or a migration ordering issue). Drizzle
does not detect this — it skips migrations whose hash is already in
the ledger, so re-running `migrate-prod.ts` does not recover the
missing tables.

**Inline workaround applied.** The missing tables were re-created by
hand-running the `.sql` migration files (they use `IF NOT EXISTS`
guards so they are safe to re-run):
```
psql "$DATABASE_URL" -f packages/database/src/migrations/0018_tenant_finance.sql
psql "$DATABASE_URL" -f packages/database/src/migrations/0020_tenant_risk_reports.sql
psql "$DATABASE_URL" -f packages/database/src/migrations/0021_compliance_exports.sql
```

The composition routers (`routes/compliance.router.ts:46`,
`routes/risk-reports.router.ts:40`) were hardened to return
structured 503 / 500 JSON bodies instead of the raw text 500 when a
DB error slips through.

**Proposed fix.**
1. Add a `scripts/verify-migrations.ts` that, at gateway boot, compares
   `drizzle.__drizzle_migrations.hash` against a list of tables each
   migration is expected to create. Emit a WARN line for each drift
   and refuse to boot in `NODE_ENV=production`.
2. Audit the CI DB + staging DB for the same drift before the fix
   lands — the CI DB is clean today but any restore-from-backup flow
   that predates this audit may ship the drift.

**Owners.** Platform / DBA.

---

## KI-002 — OpenAPI catalog drift between `export-openapi.mjs` and live routers

**Severity:** LOW (docs-only; live `/api/v1/openapi.json` is the
source of truth for clients).

**Symptoms.** The committed
`Docs/api/openapi.generated.json` listed endpoints that do not exist
in the routers and was missing endpoints that do. Examples found in
the 2026-04-19 sweep:

| Catalog (old)                                             | Router reality                                  |
|-----------------------------------------------------------|-------------------------------------------------|
| `POST /api/v1/applications`                               | Only `POST /api/v1/applications/route`          |
| `POST /api/v1/scans/pages`                                | Actual path is `POST /scans/bundles/{id}/pages` |
| `POST /api/v1/notification-webhooks/{provider}`           | Only africastalking, twilio, meta               |
| `GET /api/v1/risk-reports/{customerId}`                   | Actual path ends `/latest`                      |
| `GET /api/v1/financial-profile/{customerId}/statements`   | Only `POST /financial-profile/statements`       |
| `GET /api/v1/occupancy-timeline/{unitId}`                 | Actual `GET /{id}/occupancy-timeline`           |
| `GET /api/v1/letters`                                     | No list endpoint; only `GET /:id`               |

**Root cause.** `services/api-gateway/scripts/export-openapi.mjs`
maintains a **hand-written** `catalog` array that drifts whenever a
router is refactored without syncing the script.

**Inline workaround applied.** Patched catalog entries that had drift.
Regenerated `Docs/api/openapi.generated.json` (86 paths, previously 73).

**Proposed fix.** Replace the hand-written catalog with an invocation
of the already-working runtime harvester in
`services/api-gateway/src/openapi/route-harvester.ts` — it walks the
real Hono `.routes` table and emits the full spec (306 paths at the
time of this writing). The CLI entry point already exists at
`src/openapi/export-cli.ts`; wire `openapi:export` to call it instead
of the .mjs script.

---

## KI-003 — 40+ routers call service methods without null guards

**Severity:** LOW in production (composition root always wires
services when `DATABASE_URL` is set); MEDIUM for sandbox/demo
deployments where some services are intentionally omitted.

**Symptoms.** Any `POST` handler in e.g.
`services/api-gateway/src/routes/renewals.router.ts`,
`routes/financial-profile.router.ts`, etc. does:
```ts
const service = c.get('renewalService');
const result = await service.xxx(...);  // throws if service is undefined
```
If the service is not wired (composition-root skip), this throws
`TypeError: Cannot read properties of undefined` → raw 500.

**Sample repro.** Unset `DATABASE_URL`, boot gateway, then
`POST /api/v1/renewals/{leaseId}/propose` → 500 with no JSON body.

**Inline workaround applied.** The highest-traffic offenders
(`risk-reports.router.ts`, `compliance.router.ts`) now null-check the
service and return a structured 503.

**Proposed fix.** A small Hono middleware factory
`requireService('renewalService')` that short-circuits to a structured
503 when the service is absent. Apply it to each router. Roughly a
4-hour patch across 40+ files but behaviourally risk-free.

---

## KI-004 — MCP `relation "maintenance_cases" does not exist` when tool called

**Severity:** LOW (local-dev only; table is expected in production).

**Symptoms.** `POST /api/v1/mcp` with
`{"method":"tools/call","params":{"name":"list_maintenance_cases"}}`
returns a JSON-RPC error
`{"code":-32000,"message":"relation \"maintenance_cases\" does not exist"}`.

**Root cause.** Same ledger drift as KI-001 — migration for
`maintenance_cases` is recorded but the table is absent in the local
DB.

**Proposed fix.** Part of KI-001 — add the migrate-verify step. No
router change needed; MCP already surfaces the Postgres error cleanly
via its error envelope.
