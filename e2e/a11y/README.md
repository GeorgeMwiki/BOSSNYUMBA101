# E2E Accessibility Suite (WCAG 2.1 AA)

This folder holds the Playwright + `@axe-core/playwright` accessibility scans for
the BOSSNYUMBA web apps. CI treats **any** WCAG 2.1 A/AA violation as a hard
failure — do not `.skip` tests or loosen `runAxe` to make CI pass.

## Files

- `axe.setup.ts` — reusable `runAxe(page, testInfo, options)` helper. Wraps
  `@axe-core/playwright`, tags with `wcag2a / wcag2aa / wcag21a / wcag21aa`,
  asserts zero violations, and attaches a JSON report to the test run for
  debugging failed scans in CI.
- `owner-portal.a11y.spec.ts` — Owner Portal main routes.
- `customer-app.a11y.spec.ts` — Customer PWA (desktop + mobile viewport).
- `admin-portal.a11y.spec.ts` — Internal Admin Portal.
- `estate-manager-app.a11y.spec.ts` — Estate Manager App.

## Running locally

The repo runs a11y scans through the root Playwright config (the `e2e/` folder
does not have its own `package.json`; it is driven by root scripts). From the
repo root:

```bash
# Run the full E2E suite (functional + a11y)
pnpm test:e2e

# Run ONLY the a11y suite (recommended when iterating on a11y fixes)
pnpm test:a11y

# Fallback if the `test:a11y` script is not wired into root package.json yet:
pnpm exec playwright test --config=e2e/playwright.config.ts e2e/a11y
```

> The filter path (`e2e/a11y`) causes Playwright to only run spec files under
> `e2e/a11y/`. All a11y tests are tagged `@a11y` in their `describe` titles,
> so you can also run `pnpm exec playwright test --config=e2e/playwright.config.ts --grep @a11y`.

### Required environment

The config reads the following URLs (see `e2e/.env.example`):

- `OWNER_PORTAL_URL` (default `http://localhost:3000`)
- `ADMIN_PORTAL_URL` (default `http://localhost:3001`)
- `CUSTOMER_APP_URL` (default `http://localhost:3002`)
- `ESTATE_MANAGER_URL` (default `http://localhost:3003`)

Start the dev servers (or point at a deployed staging) before running scans.

## Interpreting failures

When `runAxe` fails, Playwright prints a compact summary per violation
(`[impact] rule-id: help · helpUrl · node selectors`) and attaches a full
`axe-report-*.json` to the test run. In CI the JSON is available on the
Playwright HTML report as an attachment. Locally, it's also in the HTML report
(`pnpm test:e2e:report`).

## Writing new a11y tests

```ts
import { test } from '@playwright/test';
import { runAxe } from './axe.setup';

test.describe('Some App @a11y', () => {
  test.use({ project: 'some-app' });

  test('pricing page passes WCAG 2.1 AA', async ({ page }, testInfo) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await runAxe(page, testInfo, { label: 'some-app-pricing' });
  });
});
```

Prefer narrow, documented `exclude: [...]` selectors over `disableRules: [...]`
to work around third-party widgets (embedded maps, payment iframes, etc.).
Always link an issue number in a comment next to any exclude / disable.

## Companion: `eslint-plugin-jsx-a11y`

Runtime axe scans catch rendered violations; `eslint-plugin-jsx-a11y` catches
a11y smells at authoring time. It is wired into each web app's ESLint config
(`apps/*/.eslintrc.cjs`) with `plugin:jsx-a11y/recommended`. Run per-app:

```bash
pnpm --filter @bossnyumba/owner-portal lint
pnpm --filter @bossnyumba/customer-app lint
pnpm --filter @bossnyumba/admin-portal lint
pnpm --filter @bossnyumba/estate-manager-app lint
```
