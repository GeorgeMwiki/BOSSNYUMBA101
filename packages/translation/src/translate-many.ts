/**
 * Batch translate helper. Mirrors @borjie/translation.
 */

import { translate } from './translate.js';
import type { Locale, Register } from './types.js';

export interface TranslateManyContext {
  readonly sourceLang: Locale;
  readonly targetLang: Locale;
  readonly tenantId: string;
  readonly register?: Register;
  readonly surface: string;
}

export async function translateMany<T extends Readonly<Record<string, string>>>(
  strings: T,
  ctx: TranslateManyContext,
): Promise<{ readonly [K in keyof T]: string }> {
  const entries = Object.entries(strings);
  const translated = await Promise.all(
    entries.map(async ([key, value]) => {
      const out = await translate({
        text: value,
        sourceLang: ctx.sourceLang,
        targetLang: ctx.targetLang,
        tenantId: ctx.tenantId,
        ...(ctx.register !== undefined ? { register: ctx.register } : {}),
        surface: `${ctx.surface}.${key}`,
      });
      return [key, out.text] as const;
    }),
  );

  const out: Record<string, string> = {};
  for (const [k, v] of translated) {
    out[k] = v;
  }
  return out as { readonly [K in keyof T]: string };
}
