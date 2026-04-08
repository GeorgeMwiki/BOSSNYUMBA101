import { test } from '@playwright/test';
import { runAxe } from './axe.setup';

/**
 * Owner Portal - WCAG 2.1 AA accessibility scans.
 *
 * Each test navigates to a top-level route and asserts zero axe-core violations.
 * Fails CI hard on any AA violation. DO NOT mark tests `.skip` or loosen the
 * `runAxe` assertion to make tests pass — fix the underlying a11y bug instead.
 *
 * Routes exercised here are the main navigational surfaces an owner hits on login.
 * Authenticated flows are intentionally kept lightweight (public/landing + top-level
 * routes rendered by the SPA shell) so scans run without requiring auth fixtures.
 */
test.describe('Owner Portal @a11y', () => {
  test.use({ project: 'owner-portal' });

  const routes: Array<{ name: string; path: string }> = [
    { name: 'login', path: '/login' },
    { name: 'dashboard', path: '/dashboard' },
    { name: 'properties', path: '/properties' },
    { name: 'financials', path: '/financials' },
    { name: 'maintenance', path: '/maintenance' },
  ];

  for (const route of routes) {
    test(`${route.name} route has zero WCAG 2.1 AA violations`, async ({
      page,
    }, testInfo) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      // Give the SPA shell a moment to hydrate and render interactive content
      // before axe walks the DOM.
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await runAxe(page, testInfo, { label: `owner-portal-${route.name}` });
    });
  }
});
