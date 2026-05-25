/**
 * Typed errors for the Verra registry client + on-chain EVM reader.
 *
 * Registry-side categories (network → Verra HTTP UI API):
 *  - `VerraParseError` — the HTTP request succeeded but the payload did
 *    not match the expected zod schema. Caller can log, fall back, or
 *    request a re-pull from upstream.
 *  - `VerraHttpError` — non-2xx response after retries were exhausted.
 *  - `VerraTimeoutError` — AbortController fired before response.
 *
 * On-chain side (JSON-RPC + IPFS gateway):
 *  - `EvmReadError` — the JSON-RPC call surfaced an error (revert, bad
 *    contract address, network outage). Carries `chain`, `contract`,
 *    `tokenId`, and (when available) the RPC error code.
 *  - `IpfsResolutionError` — the `ipfs://` URI could not be fetched
 *    from the configured gateway, or the response was non-2xx.
 *
 * All extend `VerraError` so callers may catch broadly with one type
 * (the carbon-market package mixes both concerns when verifying a
 * tokenised credit — the on-chain read feeds the off-chain registry
 * lookup, so a unified error base keeps composition shallow).
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

/**
 * On-chain JSON-RPC read failed — bad RPC URL, network timeout, contract
 * reverted (e.g. ERC-721 contract that does not implement `tokenURI`),
 * or token id does not exist.
 *
 * `cause` is the underlying error from viem / fetch so the caller can
 * inspect it without losing the typed wrapper.
 */
export class EvmReadError extends VerraError {
  override readonly name = 'EvmReadError';
  constructor(
    message: string,
    readonly chain: string,
    readonly contractAddress: string,
    readonly tokenId: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * IPFS gateway resolution failed — non-2xx response, network timeout,
 * malformed CID, or the gateway returned a non-JSON body when JSON was
 * expected. `gatewayUrl` is the resolved gateway URL we attempted.
 */
export class IpfsResolutionError extends VerraError {
  override readonly name = 'IpfsResolutionError';
  constructor(
    message: string,
    readonly cidOrUri: string,
    readonly gatewayUrl: string,
    override readonly cause?: unknown,
  ) {
    super(message);
  }
}
