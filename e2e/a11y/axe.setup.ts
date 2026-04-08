import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * Reusable accessibility scan helper wrapping @axe-core/playwright.
 *
 * Runs axe-core against the currently loaded page using the WCAG 2.1 Level A/AA
 * ruleset by default, asserts zero violations, and attaches a JSON report to the
 * test results for debugging failing scans in CI.
 *
 * CI treats any violation as a hard failure — do NOT soften this assertion in
 * individual tests. Instead, fix the underlying a11y bug in the app itself.
 *
 * Usage:
 * ```ts
 * import { runAxe } from '../axe.setup';
 *
 * test('home page has no WCAG AA violations', async ({ page }, testInfo) => {
 *   await page.goto('/');
 *   await runAxe(page, testInfo);
 * });
 * ```
 */
export interface RunAxeOptions {
  /**
   * axe tag ruleset. Defaults to WCAG 2.0 A + AA and WCAG 2.1 A + AA, which is
   * the minimum bar required by the BOSSNYUMBA a11y policy.
   */
  tags?: string[];
  /**
   * CSS selectors whose subtrees should be excluded from the scan. Useful for
   * third-party widgets (e.g. embedded maps, payment iframes) that we cannot
   * fix ourselves. Add with a linked ticket comment in the calling test.
   */
  exclude?: string[];
  /**
   * Specific axe rule IDs to disable for this scan only. Prefer narrow, scoped
   * `exclude` selectors over `disableRules` — disabling a rule globally masks
   * real violations.
   */
  disableRules?: string[];
  /**
   * Optional label used in the attached report filename. Defaults to the
   * Playwright test title.
   */
  label?: string;
}

export const WCAG_2_1_AA_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
] as const;

/**
 * Run axe-core on the given Playwright page and assert zero violations.
 *
 * @param page       - Active Playwright Page. Caller is responsible for navigating
 *                     to the route and waiting for interactive content before calling.
 * @param testInfo   - The Playwright TestInfo object, used to attach the JSON
 *                     report when violations are found.
 * @param options    - See {@link RunAxeOptions}.
 */
export async function runAxe(
  page: Page,
  testInfo: TestInfo,
  options: RunAxeOptions = {},
): Promise<void> {
  const {
    tags = [...WCAG_2_1_AA_TAGS],
    exclude = [],
    disableRules = [],
    label,
  } = options;

  let builder = new AxeBuilder({ page }).withTags(tags);

  for (const selector of exclude) {
    builder = builder.exclude(selector);
  }
  if (disableRules.length > 0) {
    builder = builder.disableRules(disableRules);
  }

  const results = await builder.analyze();

  // Always attach full results so failing runs in CI have actionable context.
  await testInfo.attach(`axe-report-${label ?? testInfo.title}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  if (results.violations.length > 0) {
    // Render a compact, human-readable summary in the test output.
    const summary = results.violations
      .map((v) => {
        const nodes = v.nodes
          .slice(0, 5)
          .map((n) => `      - ${n.target.join(' ')}`)
          .join('\n');
        return `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
      })
      .join('\n\n');

    // eslint-disable-next-line no-console
    console.error(
      `\nWCAG 2.1 AA violations found (${results.violations.length}):\n${summary}\n`,
    );
  }

  expect(
    results.violations,
    `Expected zero WCAG 2.1 AA violations, found ${results.violations.length}. See attached axe-report JSON.`,
  ).toEqual([]);
}
