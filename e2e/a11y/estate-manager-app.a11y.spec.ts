import { test } from '@playwright/test';
import { runAxe } from './axe.setup';

/**
 * Estate Manager App - WCAG 2.1 AA accessibility scans.
 *
 * Covers property manager / estate operator daily-driver routes. Fails CI hard
 * on any AA violation.
 */
test.describe('Estate Manager App @a11y', () => {
  test.use({ project: 'estate-manager' });

  const routes: Array<{ name: string; path: string }> = [
    { name: 'landing', path: '/' },
    { name: 'login', path: '/auth/login' },
    { name: 'dashboard', path: '/dashboard' },
    { name: 'work-orders', path: '/work-orders' },
    { name: 'tenants', path: '/tenants' },
  ];

  for (const route of routes) {
    test(`${route.name} route has zero WCAG 2.1 AA violations`, async ({
      page,
    }, testInfo) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await runAxe(page, testInfo, { label: `estate-manager-${route.name}` });
    });
  }
});
