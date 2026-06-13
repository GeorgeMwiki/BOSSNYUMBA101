/**
 * Live demo / production smoke tests.
 * Uses env-configured URLs only (OWNER_PORTAL_URL, etc.).
 * Run with: pnpm test:e2e -- --project=owner-portal tests/live-demo.spec.ts
 * Or set all *_URL vars and: pnpm test:e2e tests/live-demo.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Live demo — Owner Portal', () => {
  test.use({ project: 'owner-portal' });

  test('login page loads (env: OWNER_PORTAL_URL)', async ({ page }) => {
    const res = await page.goto('/login');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByText(/sign in|login|owner/i))).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 5000 });
  });
});
