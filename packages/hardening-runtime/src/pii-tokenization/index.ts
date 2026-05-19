/**
 * PII-tokenization module — L3 §8 #11.
 *
 * Surface:
 *   - `tokenizePII(text, options?)` — replace PII with tokens
 *   - `deTokenize(payload, tokenMap)` — reverse at action layer
 *   - `detectAll(text)` — low-level detector (8 classes)
 */

export { tokenizePII, deTokenize } from './tokenize.js';
export type { TokenizeOptions, DeTokenizeResult } from './tokenize.js';
export { detectAll } from './detectors.js';
export type { DetectedSpan } from './detectors.js';
