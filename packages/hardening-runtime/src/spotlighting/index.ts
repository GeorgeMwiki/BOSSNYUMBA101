/**
 * Spotlighting module — L3 §3.4, §8 #7.
 *
 * Surface:
 *   - `spotlight(content, sourceUri)` — wrap one retrieved chunk
 *   - `SPOTLIGHT_OPEN`, `SPOTLIGHT_CLOSE` — delimiter constants
 *   - `SPOTLIGHT_SYSTEM_DIRECTIVE` — prepend-to-system-prompt boilerplate
 */

export {
  spotlight,
  SPOTLIGHT_OPEN,
  SPOTLIGHT_CLOSE,
  SPOTLIGHT_SYSTEM_DIRECTIVE,
} from './spotlight.js';
