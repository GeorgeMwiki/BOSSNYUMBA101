# BOSSNYUMBA E2E Tests (Playwright)

End-to-end coverage for the critical user flows of the BOSSNYUMBA platform's
web surfaces: **owner-portal** and **admin-platform-portal**.

> Customer + workforce surfaces are the Expo **mobile** apps
> (`tenant-mobile` / `staff-mobile`) and are covered by their own test suites,
> not by this Playwright project.

## Directory layout

```
e2e/
  playwright.config.ts          Playwright config (projects per portal)
  fixtures/                     Shared test data + auth fixtures
  helpers.ts                    Common helpers (selectors, waiting)
  page-objects/                 Page-object classes per portal
  tests/                        Portal spec files
  tests/critical-flows/         Cross-cutting critical flow specs
    cross-tenant-isolation/     RLS / tenant-isolation regression net
    gdpr-pdpa/                  Data-export + account-deletion flows
    mpesa-stk-callback/         M-Pesa STK push callback variants
    session-refresh/            Token-expiry / refresh-flow coverage
  tests/journeys/               Owner + platform deep-scrub journeys
  tests/ui-smoke/               Cold-load console/HTTP smoke per portal
```

## Running locally

Install deps and Playwright browsers:

```bash
pnpm install
pnpm exec playwright install --with-deps chromium
```

Start the dev servers (separate terminals or tmux panes):

```bash
pnpm --filter @bossnyumba/owner-portal dev            # http://localhost:3000
pnpm --filter @bossnyumba/admin-platform-portal dev   # http://localhost:3001
```

Run everything:

```bash
pnpm test:e2e
```

Run a single spec:

```bash
pnpm exec playwright test --config e2e/playwright.config.ts \
  e2e/tests/owner-portal/dashboard.spec.ts
```

Run only the critical-flows folder:

```bash
pnpm exec playwright test --config e2e/playwright.config.ts \
  e2e/tests/critical-flows
```

Filter by project (portal):

```bash
pnpm exec playwright test --project=owner-portal
```

## Environment variables

Copy `e2e/.env.example` to `e2e/.env` and populate. Critical ones:

| Variable | Purpose |
|----------|---------|
| `OWNER_PORTAL_URL` | Owner portal base URL (default `http://localhost:3000`) |
| `ADMIN_PORTAL_URL` | Admin platform portal base URL (default `http://localhost:3001`) |
| `E2E_TEST_PHONE` | Tanzania-format phone for seed login (+2557...) |

## Fixture data

- `fixtures/data.fixture.ts` — property, lease, work-order generators
- `fixtures/test-data.ts` — canonical test users / tenants / properties
- `fixtures/auth.ts` — authentication storage state helpers
- `fixtures/seed.sql` + `fixtures/seed-runner.ts` — real-backend seed data

The cross-cutting specs use their own inline mocks so they do not depend on
seeded DB data where possible. This keeps them hermetic in CI.

## Debugging failing tests

1. **UI mode** (fastest feedback loop):

   ```bash
   pnpm exec playwright test --ui
   ```

2. **Headed with slow-mo**:

   ```bash
   pnpm exec playwright test --headed --project=owner-portal --slow-mo=500
   ```

3. **Inspect a single step**:

   ```bash
   PWDEBUG=1 pnpm exec playwright test e2e/tests/owner-portal/dashboard.spec.ts
   ```

4. **Trace viewer** — on CI, traces are stored on first retry. Download the
   `playwright-report-strict` artifact from the failed job and run:

   ```bash
   pnpm exec playwright show-trace path/to/trace.zip
   ```

5. **Show the last HTML report**:

   ```bash
   pnpm exec playwright show-report e2e/e2e-report
   ```

## CI integration

- `ci.yml` — legacy non-blocking workflow (current baseline)
- `strict-ci.yml` — blocking lint / typecheck / unit / build / e2e across Node 20 & 22
- `db-migrations-check.yml` — forward-only linter + empty-Postgres dry run
- `security-scan.yml` — `pnpm audit`, `gitleaks`, npm-check-updates report
- `deploy-staging.yml` — gated by Strict CI before staging deploy

Playwright artifacts (`e2e/e2e-report/`, `e2e/test-results/`) are uploaded on
failure from the `E2E (Playwright, strict)` job and retained for 14 days.

## Adding a new portal spec

1. Create `e2e/tests/owner-portal/<flow>.spec.ts` (or another portal folder)
2. Pin the project with `test.use({ project: 'owner-portal' })`
3. Mock external calls with `page.route()` — do NOT hit real third-party services
4. Assert on both **UI state** (text visible, URL matches) and **API responses**
   where applicable (via `page.request.get(...)`)
5. Run locally with `--ui` before opening a PR
```
