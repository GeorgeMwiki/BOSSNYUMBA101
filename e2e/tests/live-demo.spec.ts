/**
 * Live demo / production smoke tests.
 * Covers: page loads, i18n language switching, locale persistence.
 * Uses env-configured URLs (OWNER_PORTAL_URL, ADMIN_PORTAL_URL, etc.).
 * Run with: pnpm test:e2e:demo
 * Or specific project: pnpm test:e2e -- --project=owner-portal tests/live-demo.spec.ts
 */

import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Owner Portal
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live demo — Owner Portal', () => {
  test('login page loads', async ({ page }) => {
    const base = process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000';
    const res = await page.goto(`${base}/login`);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1 }).or(page.getByText(/sign in|login|owner/i))
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('dashboard loads with i18n content', async ({ page }) => {
    const base = process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000';
    await page.goto(base);
    await expect(
      page.getByText(/Owner Dashboard|Dashibodi ya Mmiliki/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test('language switcher present and functional', async ({ page }) => {
    const base = process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000';
    await page.goto(base);
    const langSelect = page.locator('select[aria-label="Select language"]');
    await expect(langSelect).toBeVisible({ timeout: 10000 });
    await langSelect.selectOption('sw');
    await expect(page.getByText(/Dashibodi ya Mmiliki/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Portal
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live demo — Admin Portal', () => {
  test('login page loads', async ({ page }) => {
    const base = process.env.ADMIN_PORTAL_URL ?? 'http://localhost:3001';
    const res = await page.goto(`${base}/login`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/admin|sign in|login|internal/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('dashboard loads with i18n', async ({ page }) => {
    const base = process.env.ADMIN_PORTAL_URL ?? 'http://localhost:3001';
    await page.goto(base);
    await expect(
      page.getByText(/Admin Dashboard|Dashibodi ya Msimamizi/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test('language switcher works', async ({ page }) => {
    const base = process.env.ADMIN_PORTAL_URL ?? 'http://localhost:3001';
    await page.goto(base);
    const langSelect = page.locator('select[aria-label="Select language"]');
    await expect(langSelect).toBeVisible({ timeout: 10000 });
    await langSelect.selectOption('sw');
    await expect(page.getByText(/Dashibodi ya Msimamizi/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer App
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live demo — Customer App', () => {
  test('app loads', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    const res = await page.goto(base);
    expect(res?.status()).toBe(200);
    await expect(
      page.getByText(/login|sign in|phone|get started|BOSSNYUMBA/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('login page displays translated content', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    await page.goto(`${base}/auth/login`);
    await expect(page.getByText('BOSSNYUMBA')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/Sign in to your BOSSNYUMBA account|Ingia kwenye akaunti/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('settings page language switcher works', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    await page.goto(`${base}/settings`);
    const langSelect = page.locator('#language');
    await expect(langSelect).toBeVisible({ timeout: 10000 });
    await langSelect.selectOption('sw');
    await expect(page.getByText(/Mipangilio/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Arifa za push/i)).toBeVisible({ timeout: 10000 });
  });

  test('payments page loads with translations', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    await page.goto(`${base}/payments`);
    await expect(page.getByText(/Payments|Malipo/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('maintenance page loads with translations', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    await page.goto(`${base}/maintenance`);
    await expect(page.getByText(/Maintenance|Matengenezo/i).first()).toBeVisible({ timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Estate Manager
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live demo — Estate Manager', () => {
  test('login page loads', async ({ page }) => {
    const base = process.env.ESTATE_MANAGER_URL ?? 'http://localhost:3003';
    const res = await page.goto(`${base}/login`);
    expect(res?.status()).toBe(200);
    await expect(page.getByText(/manager|sign in|login|estate/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('dashboard loads with translated content', async ({ page }) => {
    const base = process.env.ESTATE_MANAGER_URL ?? 'http://localhost:3003';
    await page.goto(base);
    await expect(page.getByText(/Dashboard|Dashibodi/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('settings page has language switcher', async ({ page }) => {
    const base = process.env.ESTATE_MANAGER_URL ?? 'http://localhost:3003';
    await page.goto(`${base}/settings`);
    const langSelect = page.locator('#language');
    await expect(langSelect).toBeVisible({ timeout: 10000 });
    await langSelect.selectOption('sw');
    await expect(page.getByText(/Mipangilio/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Toka/i)).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-portal: i18n locale persistence
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Live demo — i18n persistence', () => {
  test('locale persists across page navigation', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    // Set to Swahili on settings page
    await page.goto(`${base}/settings`);
    const langSelect = page.locator('#language');
    await langSelect.selectOption('sw');
    await expect(page.getByText(/Mipangilio/i)).toBeVisible({ timeout: 10000 });

    // Navigate to maintenance page — should still be in Swahili
    await page.goto(`${base}/maintenance`);
    await expect(page.getByText(/Matengenezo/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('locale stored in localStorage', async ({ page }) => {
    const base = process.env.CUSTOMER_APP_URL ?? 'http://localhost:3002';
    await page.goto(`${base}/settings`);
    const langSelect = page.locator('#language');
    await langSelect.selectOption('sw');

    const storedLocale = await page.evaluate(() =>
      localStorage.getItem('bossnyumba-locale')
    );
    expect(storedLocale).toBe('sw');
  });
});
