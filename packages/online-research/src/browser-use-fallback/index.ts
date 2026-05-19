/**
 * browser-use-fallback — public surface.
 *
 * Closes L2 #12: Browser-Use OSS cheap-loop fallback driven by Haiku 4.5
 * for headless extraction where Anthropic Computer Use is over-budget
 * or ZDR isn't required. No PI defense ships in Browser-Use itself —
 * the safety wrap supplies a regex shield until M-E lands.
 */

export {
  createSafeBrowserUseDriver,
  type SafeBrowserUseDeps,
} from './safety-wrap.js';
export {
  createRegexInputShield,
  createNoopInputShield,
} from './input-shield.js';
export {
  createInMemoryBrowserDriver,
  type InMemoryBrowserDriverConfig,
  type InMemoryBrowserScript,
} from './in-memory-driver.js';
