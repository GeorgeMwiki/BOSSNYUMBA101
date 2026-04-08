import { test } from '@playwright/test';
import { runAxe } from './axe.setup';

/**
 * Customer App - WCAG 2.1 AA accessibility scans.
 *
 * Scans the customer PWA shell + key tenant-facing routes. Fails CI hard on
 * any AA violation. See axe.setup.ts for the ruleset and policy.
 */
test.describe('Customer App @a11y', () => {
  test.use({ project: 'customer-app' });

  const routes: Array<{ name: string; path: string }> = [
    { name: 'landing', path: '/' },
    { name: 'login', path: '/auth/login' },
    { name: 'home', path: '/home' },
    { name: 'payments', path: '/payments' },
    { name: 'maintenance', path: '/maintenance' },
  ];

  for (const route of routes) {
    test(`${route.name} route has zero WCAG 2.1 AA violations`, async ({
      page,
    }, testInfo) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await runAxe(page, testInfo, { label: `customer-app-${route.name}` });
    });
  }
});

test.describe('Customer App @a11y (mobile viewport)', () => {
  test.use({ project: 'customer-app-mobile' });

  test('landing route passes WCAG 2.1 AA on mobile viewport', async ({
    page,
  }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await runAxe(page, testInfo, { label: 'customer-app-mobile-landing' });
  });
});
