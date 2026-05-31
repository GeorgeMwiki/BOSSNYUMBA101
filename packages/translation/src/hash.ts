/**
 * Content-hash helper for the BN translation cache. Mirrors
 * @borjie/translation's hash.ts.
 */

import { createHash } from 'node:crypto';
import type { TranslationCacheKey } from './types.js';

const FIELD_SEP = '␟'; // unit-separator

export function canonicalCacheString(key: TranslationCacheKey): string {
  return [
    key.sourceLang,
    key.targetLang,
    key.register,
    key.surface,
    key.sourceText,
  ].join(FIELD_SEP);
}

export function contentHash(key: TranslationCacheKey): string {
  return createHash('sha256').update(canonicalCacheString(key), 'utf8').digest('hex');
}
