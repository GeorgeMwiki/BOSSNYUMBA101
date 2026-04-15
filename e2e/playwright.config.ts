import { defineConfig, devices } from '@playwright/test';

/**
 * BOSSNYUMBA Platform E2E Configuration
 * Uses env: OWNER_PORTAL_URL, ADMIN_PORTAL_URL, CUSTOMER_APP_URL, ESTATE_MANAGER_URL.
 * For live demo, set these and optionally E2E_TEST_* (see e2e/.env.example), or source e2e/.env before running.
 * @see https://playwright.dev/docs/test-configuration
 */
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
    baseURL: process.env.BASE_URL ?? 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    
    /* Viewport size */
    viewport: { width: 1280, height: 720 },
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Locale and timezone */
    locale: 'en-KE',
    timezoneId: 'Africa/Nairobi',
  },
  
  /* Configure projects for different portals */
  projects: [
    /* Setup project for authentication state */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    /* Estate Manager Portal */
    {
      name: 'estate-manager',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.ESTATE_MANAGER_URL ?? 'http://localhost:3003',
      },
      // dependencies: ['setup'],
    },
    
    /* Customer Mobile App / PWA */
    {
      name: 'customer-app',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002',
      },
    },
    
    /* Customer App - Mobile viewport */
    {
      name: 'customer-app-mobile',
      use: {
        ...devices['iPhone 13'],
        baseURL: process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002',
      },
    },
    
    /* Owner Portal */
    {
      name: 'owner-portal',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000',
      },
    },
    
    /* Admin Portal (Internal) */
    {
      name: 'admin-portal',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.ADMIN_PORTAL_URL ?? 'http://localhost:3001',
      },
    },
  ],
  
  /**
   * Auto-start local dev servers for e2e. Skipped when env URLs are provided
   * (CI or staging-deployed runs) — Playwright treats missing webServer as a
   * no-op if `reuseExistingServer` is true and the port already responds.
   * Opt out entirely by setting E2E_SKIP_WEBSERVER=1.
   */
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: 'pnpm --filter @bossnyumba/estate-manager-app dev',
          url: process.env.ESTATE_MANAGER_URL ?? 'http://localhost:3003',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter @bossnyumba/customer-app dev',
          url: process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter @bossnyumba/owner-portal dev',
          url: process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter @bossnyumba/admin-portal dev',
          url: process.env.ADMIN_PORTAL_URL ?? 'http://localhost:3001',
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      ],
});
