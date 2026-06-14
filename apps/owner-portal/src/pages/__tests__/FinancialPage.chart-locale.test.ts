/**
 * Regression: FinancialPage chart month labels must follow the active UI locale,
 * never a hard-coded jurisdiction. Line ~142 previously pinned
 * `toLocaleDateString('en-KE', …)`, violating the CLAUDE.md no-hard-coded-
 * jurisdiction rule (TZ is the launch market; KE is a planned expansion) AND
 * forcing English month labels regardless of the sw/en toggle. The fix resolves
 * the locale via useLocaleContext() and maps it through chartLocaleTag()
 * (en->en-GB, sw->sw-TZ), matching Disbursements.tsx. Source-scan live detector.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'FinancialPage.tsx'),
  'utf8',
);

describe('FinancialPage — no hard-coded jurisdiction locale (chart month labels)', () => {
  it('does NOT hard-code en-KE (or any *-KE jurisdiction tag)', () => {
    expect(SRC).not.toContain("'en-KE'");
    expect(SRC).not.toMatch(/['"][a-z]{2}-KE['"]/);
  });

  it('resolves the chart-label locale from the active UI locale via chartLocaleTag', () => {
    expect(SRC).toContain('useLocaleContext');
    expect(SRC).toContain('chartLocaleTag(locale)');
  });
});
