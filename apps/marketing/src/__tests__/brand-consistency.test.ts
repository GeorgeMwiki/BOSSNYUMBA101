/**
 * Brand-consistency guard.
 *
 * The canonical wordmark is "BossNyumba" (one word), per CLAUDE.md and the
 * design-system Wordmark. The space-form "Boss Nyumba" must NOT ship in any
 * product / brand copy or metadata title across the marketing app — it had
 * regressed into ~30 surfaces (tab titles, SEO/social descriptions, legal copy)
 * and a capability-truth pass normalized them.
 *
 * The ONLY legitimate space-form is the registered legal entity
 * "Boss Nyumba Limited" (registered in Tanzania — the data controller in
 * privacy/terms). This test fails CI if the space-form product wordmark
 * regresses, so the normalization cannot silently slide back.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

describe('brand consistency — canonical wordmark "BossNyumba"', () => {
  it('never ships the space-form "Boss Nyumba" except the registered legal entity "Boss Nyumba Limited"', () => {
    const offenders: string[] = [];
    for (const file of walk(APP_DIR)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // "Boss Nyumba" NOT immediately followed by " Limited" (the
          // registered company name keeps the space form).
          if (/Boss Nyumba(?! Limited)/.test(line)) {
            offenders.push(`app/${relative(APP_DIR, file)}:${i + 1}  ${line.trim()}`);
          }
        });
    }
    expect(
      offenders,
      `Use the canonical "BossNyumba" wordmark (one word). Space-form offenders:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
