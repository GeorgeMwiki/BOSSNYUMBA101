/**
 * Input-shield module — L3 §8 #2.
 *
 * Surface:
 *   - `screenInput(text, options?)` — async; returns ShieldVerdict
 *   - `SHIELD_PATTERNS` — readable pattern catalog (for inspection / dashboards)
 *   - `SHIELD_BLOCK_THRESHOLD` — cumulative-weight cutoff
 *   - `LakeraClient` — port for commercial classifier wiring
 */

export { screenInput } from './screen-input.js';
export type { LakeraClient, ScreenInputOptions } from './screen-input.js';
export { SHIELD_PATTERNS, SHIELD_BLOCK_THRESHOLD } from './patterns.js';
export type { ShieldPattern } from './patterns.js';
