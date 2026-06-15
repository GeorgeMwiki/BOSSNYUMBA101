import { defineConfig, devices } from '@playwright/test';

/**
 * BOSSNYUMBA Platform E2E Configuration
 *
 * Real-backend mode (default — production-faithful, used by CI):
 *   - Start the stack with `docker compose -f docker-compose.e2e.yml up -d --wait`
 *     (or `pnpm test:e2e:local`) which boots postgres + api-gateway + owner-portal.
 *   - Specs hit the real api-gateway. `page.route()` mocks of internal endpoints
 *     are FORBIDDEN — they hid the FeedbackThumbs 👍/👎 schema mismatch the
 *     wave-K audit caught. Third-party connectors (M-Pesa STK) MAY be mocked at
 *     the network level, but the api-gateway itself never is.
 *
 * Legacy stub-server mode (opt-in only):
 *   - Set `E2E_USE_STUB=1` to boot the lightweight HTML stub on the portal port.
 *     Specs that use `page.route()` still pass, but THIS PATH CAN HIDE BUGS.
 *     Reserved for local iteration on UI selectors, never the default.
 *
 * Environment overrides (CI / staging): OWNER_PORTAL_URL, ADMIN_PORTAL_URL,
 * API_GATEWAY_URL, E2E_TEST_* creds. (Customer + workforce surfaces are the
 * Expo mobile apps — tenant-mobile / staff-mobile — and have their own suites.)
 * @see https://playwright.dev/docs/test-configuration
 */

const USE_STUB = process.env.E2E_USE_STUB === '1';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'e2e-report' }],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  /* Global timeout for each test */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,

    /* Viewport size */
    viewport: { width: 1280, height: 720 },

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Locale and timezone — Kenya pilot E2E browser context */
    // eslint-disable-next-line bossnyumba/no-jurisdictional-literal -- pilot-country E2E test browser locale
    locale: 'en-KE',
    // eslint-disable-next-line bossnyumba/no-jurisdictional-literal -- pilot-country E2E test browser timezone
    timezoneId: 'Africa/Nairobi',
  },

  /*
   * Project scoping.
   *
   *   - Each project pins `testMatch` to a set of subdirectories under tests/
   *     so `--project=owner-portal` enumerates ONLY owner-portal/** and a run
   *     can be scoped to a single surface without leaking another's specs.
   *
   *   - INVARIANT: the union of every project's `testMatch` MUST cover every
   *     *.spec.ts under tests/. A spec that matches no project is SILENTLY
   *     dropped from `pnpm test:e2e` (the default no-filter run) — that is how
   *     all 23 @security @critical critical-flows specs went uncollected for a
   *     full wave. `e2e/scripts/assert-spec-coverage.mjs` (run in CI before the
   *     suite, via `pnpm test:e2e:assert-coverage`) fails loudly if any spec is
   *     unmatched, so this invariant cannot silently regress.
   *
   *   - Surface → project map (keep in sync with testMatch below):
   *       owner-portal/**                         → owner-portal
   *       journeys/owner-live-tests/**            → owner-live-journeys
   *       critical-flows/**                       → critical-flows
   *       journeys/*.spec.ts, real-llm/**,
   *         ui-smoke/**, tests/*.spec.ts (root)   → platform-journeys
   *
   *   - Customer + workforce surfaces are the Expo mobile apps
   *     (tenant-mobile / staff-mobile) and are tested in their own suites,
   *     not via these browser projects.
   */
  projects: [
    /* Setup project for authentication state */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    /* Owner Portal */
    {
      name: 'owner-portal',
      testMatch: 'owner-portal/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000',
      },
    },

    /*
     * Phase F.5 owner-live journey suite — 10 specs covering critical
     * owner workflows (signup → maintenance → arrears → KRA → briefing →
     * plan-mode → Skills → slash-commands). Each spec self-skips when
     * USE_REAL_SERVERS is unset so the project stays green on PR runs
     * that don't boot the docker-compose stack.
     */
    {
      name: 'owner-live-journeys',
      testMatch: 'journeys/owner-live-tests/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000',
      },
    },

    /*
     * @security @critical critical-flows suite — cross-tenant isolation,
     * GDPR/PDPA delete + export, M-Pesa STK callback, and session-refresh
     * specs. These are the multi-tenant launch blockers; they MUST be
     * collected. Each spec self-skips when REAL_BACKEND_ENABLED is unset
     * (set E2E_ENABLE_REAL_BACKEND=1 with the docker-compose.e2e stack up),
     * so the project stays green on PR runs that don't boot the stack but
     * runs for real in the docker-backed CI job.
     */
    {
      name: 'critical-flows',
      testMatch: 'critical-flows/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000',
      },
    },

    /*
     * Platform journeys — every remaining browser spec: the root tests/*.spec.ts
     * (auth, brain-chat-owner, owner-dashboard, owner-portal, live-demo),
     * journeys/*.spec.ts (admin-platform-cert-revoke, owner-damage-deductions,
     * owner-gamification), real-llm/** (gated on E2E_REAL_LLM + ANTHROPIC_API_KEY)
     * and ui-smoke/**. Without this project these specs match no testMatch and
     * are silently dropped. Each self-skips behind its own env guard.
     */
    {
      name: 'platform-journeys',
      testMatch: [
        '*.spec.ts',
        'journeys/*.spec.ts',
        'real-llm/**/*.spec.ts',
        'ui-smoke/**/*.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000',
      },
    },
  ],

  /*
   * Local dev servers.
   *
   * Real-backend mode (default): `webServer` is undefined — the operator runs
   * `docker compose -f docker-compose.e2e.yml up -d --wait` BEFORE
   * `pnpm test:e2e`. That way the api-gateway, owner-portal, and postgres all
   * boot from the production-faithful Dockerfiles, real auth/feedback/payment
   * flows execute, and specs cannot accidentally mock internal endpoints.
   *
   * Stub-server mode (`E2E_USE_STUB=1`): boot the legacy node HTML stubs for
   * fast local iteration. Kept for backwards compat — DO NOT USE IN CI.
   */
  webServer: USE_STUB
    ? [
        {
          command: 'PORT=3000 node stub-server/stub.mjs',
          url: 'http://localhost:3000/__stub_ready',
          reuseExistingServer: !process.env.CI,
          timeout: 15000,
        },
        {
          command: 'PORT=3001 node stub-server/stub.mjs',
          url: 'http://localhost:3001/__stub_ready',
          reuseExistingServer: !process.env.CI,
          timeout: 15000,
        },
      ]
    : undefined,
});
