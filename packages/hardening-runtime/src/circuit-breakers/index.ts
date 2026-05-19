/**
 * Circuit-breakers module — L3 §8 #3.
 *
 * Surface:
 *   - `withCircuitBreaker(step, options)` — guarded execution wrapper
 *   - `DEFAULT_CIRCUIT_BREAKER_CAPS` — platform default caps
 *   - `mergeCaps(override)` — produce a frozen, merged caps object
 */

export { withCircuitBreaker } from './with-circuit-breaker.js';
export type {
  StepResult,
  WithCircuitBreakerOptions,
} from './with-circuit-breaker.js';
export { DEFAULT_CIRCUIT_BREAKER_CAPS, mergeCaps } from './caps.js';
