/**
 * Typed errors for the Verra registry client.
 *
 * The client surfaces three categories:
 *  - `VerraParseError` — the HTTP request succeeded but the payload did
 *    not match the expected zod schema. Caller can log, fall back, or
 *    request a re-pull from upstream.
 *  - `VerraHttpError` — non-2xx response after retries were exhausted.
 *  - `VerraTimeoutError` — AbortController fired before response.
 *
 * All three extend the same base so callers may catch broadly.
 */

export class VerraError extends Error {
  override readonly name: string = 'VerraError';
  constructor(message: string) {
    super(message);
  }
}

export class VerraParseError extends VerraError {
  override readonly name = 'VerraParseError';
  constructor(
    message: string,
    readonly issues: ReadonlyArray<string>,
  ) {
    super(message);
  }
}

export class VerraHttpError extends VerraError {
  override readonly name = 'VerraHttpError';
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
  }
}

export class VerraTimeoutError extends VerraError {
  override readonly name = 'VerraTimeoutError';
  constructor(
    message: string,
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(message);
  }
}
