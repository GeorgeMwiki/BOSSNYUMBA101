/**
 * Outbound circuit breaker — SCAFFOLDED 10
 *
 * Wraps outbound `fetch` calls with the `opossum` circuit breaker so that
 * downstream services in a degraded state don't consume the gateway's
 * request budget. Once the breaker is `open`, fetches fail fast with a
 * predictable `CircuitOpenError` that the error-envelope middleware
 * renders as 503.
 *
 * NOTE: `opossum` must be added to `services/api-gateway/package.json`:
 *     "opossum": "^8.1.0"
 * This file uses a dynamic import so it degrades gracefully in dev
 * environments where the dep hasn't been installed yet.
 */

export interface CircuitBreakerOptions {
  /** Default timeout for the wrapped call (ms). Default: 10_000. */
  timeout?: number;
  /** Error percentage that trips the breaker. Default: 50. */
  errorThresholdPercentage?: number;
  /** Breaker reset window (ms). Default: 30_000. */
  resetTimeout?: number;
  /** Bucket window for stats (ms). Default: 10_000. */
  rollingCountTimeout?: number;
  /** Number of buckets in the rolling window. Default: 10. */
  rollingCountBuckets?: number;
  /** Name used in logs / metrics. */
  name?: string;
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';
  constructor(breakerName: string) {
    super(`Circuit breaker '${breakerName}' is open`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Wrap an arbitrary async function with a circuit breaker. Returns a
 * Promise-returning function with the same signature; invoke it exactly
 * as you would the original.
 */
export async function wrapWithCircuitBreaker<
  TArgs extends unknown[],
  TResult,
>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions = {}
): Promise<(...args: TArgs) => Promise<TResult>> {
  const name = options.name ?? fn.name ?? 'unnamed';
  const timeout = options.timeout ?? 10_000;
  const errorThresholdPercentage = options.errorThresholdPercentage ?? 50;
  const resetTimeout = options.resetTimeout ?? 30_000;
  const rollingCountTimeout = options.rollingCountTimeout ?? 10_000;
  const rollingCountBuckets = options.rollingCountBuckets ?? 10;

  // Dynamic import so the file parses when opossum is not installed.
  let opossumModule: { default: unknown } | undefined;
  try {
    opossumModule = (await import('opossum')) as { default: unknown };
  } catch {
    // Fallback — no circuit protection, but call still succeeds.
    return fn;
  }
  const CircuitBreaker = (opossumModule.default ?? opossumModule) as new (
    action: (...args: TArgs) => Promise<TResult>,
    opts: Record<string, unknown>
  ) => {
    fire(...args: TArgs): Promise<TResult>;
    on(event: string, listener: (...a: unknown[]) => void): void;
  };

  const breaker = new CircuitBreaker(fn, {
    timeout,
    errorThresholdPercentage,
    resetTimeout,
    rollingCountTimeout,
    rollingCountBuckets,
    name,
  });

  breaker.on('open', () => {
    // Intentionally minimal — callers can wire structured logging by
    // passing a wrapped `fn` that logs on its own failure paths.
    // eslint-disable-next-line no-console
    console.warn(`[circuit-breaker] ${name}: opened`);
  });
  breaker.on('halfOpen', () => {
    // eslint-disable-next-line no-console
    console.info(`[circuit-breaker] ${name}: half-open`);
  });
  breaker.on('close', () => {
    // eslint-disable-next-line no-console
    console.info(`[circuit-breaker] ${name}: closed`);
  });

  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await breaker.fire(...args);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Breaker is open')) {
        throw new CircuitOpenError(name);
      }
      throw err;
    }
  };
}

/**
 * Convenience: wrap `fetch` directly.
 */
export async function createCircuitBrokenFetch(
  options: CircuitBreakerOptions = {}
): Promise<typeof fetch> {
  const wrapped = await wrapWithCircuitBreaker(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      fetch(input, init),
    { name: options.name ?? 'outbound-fetch', ...options }
  );
  return wrapped as typeof fetch;
}
