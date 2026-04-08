import { test } from '@playwright/test';
import { runAxe } from './axe.setup';

/**
 * Admin Portal - WCAG 2.1 AA accessibility scans.
 *
 * Covers the internal admin surfaces: login, tenant management, user management,
 * audit log, and system health. Fails CI hard on any AA violation.
 */
test.describe('Admin Portal @a11y', () => {
  test.use({ project: 'admin-portal' });

  const routes: Array<{ name: string; path: string }> = [
    { name: 'login', path: '/login' },
    { name: 'tenants', path: '/tenants' },
    { name: 'users', path: '/users' },
    { name: 'audit-log', path: '/audit-log' },
    { name: 'system-health', path: '/system-health' },
  ];

  for (const route of routes) {
    test(`${route.name} route has zero WCAG 2.1 AA violations`, async ({
      page,
    }, testInfo) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await runAxe(page, testInfo, { label: `admin-portal-${route.name}` });
    });
  }
});
