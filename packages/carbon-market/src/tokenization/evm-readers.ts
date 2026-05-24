/**
 * Production `EvmReader` — backed by viem.
 *
 * Closes the deferred P6 production-readiness gap: the in-tree verifier
 * only had a mock reader. This adapter implements the `EvmReader` port
 * (declared in `../types.ts`) by reading `tokenURI(uint256)` on an
 * ERC-721 contract via `viem.createPublicClient(...).readContract(...)`.
 *
 * Fallback: if the contract does NOT implement `tokenURI` (some bridges
 * — Toucan/KlimaDAO/Moss — issue ERC-1155 vintage NFTs), we re-issue
 * the call against the ERC-1155 `uri(uint256)` signature. Either
 * resolves to a URI string; we then resolve the URI:
 *
 *   - `data:application/json,...` (or `;base64,...`) — parse inline
 *     metadata without a network hop. Toucan does this for some test
 *     deployments.
 *   - `ipfs://<cid>[/path]` — rewrite to the configured gateway
 *     (default `https://w3s.link/ipfs/`) and fetch JSON over HTTPS.
 *   - `https://...` / `http://...` — fetch JSON directly.
 *
 * All RPC + HTTP calls are wrapped in a 20s `AbortController` so a
 * misbehaving RPC node cannot stall a kernel turn. Failures surface as
 * `EvmReadError` (RPC side) or `IpfsResolutionError` (gateway side) so
 * the verifier's narrative can attribute the cause precisely.
 *
 * Supported chains: Polygon (chainId 137), Celo (42220), Ethereum
 * mainnet (1), Base (8453). Production composition roots inject the
 * RPC URL per chain (Alchemy / Infura / public RPC). Tests inject a
 * stub `HttpTransport` so the suite stays offline.
 *
 * No globals: `fetch` is injected via the `HttpTransport` port the
 * verra client already declares, so the same composition that wires
 * the registry client can wire the EVM reader without a second port.
 */

import { createPublicClient, http, parseAbi, type Address, type Chain } from 'viem';
import { polygon, celo, mainnet, base } from 'viem/chains';
import type {
  EvmChain,
  EvmReader,
  HttpRequestOptions,
  HttpTransport,
  TokenizedCreditRef,
} from '../types.js';
import { EvmReadError, IpfsResolutionError } from '../verra/errors.js';

/** Default RPC read timeout (matches `DEFAULT_TIMEOUT_MS / 1.5` of the
 *  Verra HTTP client — RPC nodes are typically slower than registry UI). */
export const DEFAULT_RPC_TIMEOUT_MS = 20_000;

/** Default IPFS gateway. `w3s.link` is the web3.storage public gateway —
 *  reliable + free; operators can override at construction time. */
export const DEFAULT_IPFS_GATEWAY = 'https://w3s.link/ipfs/';

/** Minimal ERC-721 / ERC-1155 ABI fragment we read. */
const TOKEN_URI_ABI = parseAbi([
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function uri(uint256 tokenId) view returns (string)',
]);

// Widen the chain map entries to the generic `Chain` shape — viem's
// concrete chain types (e.g. Celo) extend the base with chain-specific
// block fields that don't unify in the discriminated `Chain` union
// expected by `createPublicClient`.
const CHAIN_MAP: Record<EvmChain, Chain> = {
  polygon: polygon as Chain,
  celo: celo as Chain,
  ethereum: mainnet as Chain,
  base: base as Chain,
};

export interface CreateViemEvmReaderOptions {
  /** Target chain — drives the viem chain object handed to `createPublicClient`. */
  readonly chain: EvmChain;
  /** HTTPS RPC endpoint (e.g. Alchemy / Infura / public node). */
  readonly rpcUrl: string;
  /** Optional override for the IPFS gateway prefix. Must end with `/`. */
  readonly ipfsGateway?: string;
  /** Optional override for the RPC + gateway timeout (ms). */
  readonly timeoutMs?: number;
  /**
   * Injectable HTTP transport for the IPFS resolution step. Tests inject
   * a deterministic fake; production wires the default `createFetchTransport`
   * from the verra client (or any equivalent). Optional — if omitted, the
   * reader will lazily build a transport around `globalThis.fetch`.
   */
  readonly httpTransport?: HttpTransport;
}

/**
 * Build a production `EvmReader` for the supplied chain + RPC URL.
 * Throws if the chain id is unknown.
 */
export function createViemEvmReader(opts: CreateViemEvmReaderOptions): EvmReader {
  const chainDef = CHAIN_MAP[opts.chain];
  if (!chainDef) {
    throw new Error(`createViemEvmReader: unsupported chain "${opts.chain}"`);
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
  const ipfsGateway = ensureTrailingSlash(opts.ipfsGateway ?? DEFAULT_IPFS_GATEWAY);
  const httpTransport = opts.httpTransport ?? defaultHttpTransport();

  // viem `http` transport: hand-roll the AbortSignal so we get one
  // unified timeout for both the JSON-RPC dial and any in-flight call.
  const client = createPublicClient({
    chain: chainDef,
    transport: http(opts.rpcUrl, { timeout: timeoutMs }),
  });

  return {
    async tokenURI(ref) {
      const uri = await readUri(client, ref, timeoutMs);
      return await resolveUri(uri, ipfsGateway, httpTransport, timeoutMs, ref);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// RPC layer — tokenURI / uri fallback
// ─────────────────────────────────────────────────────────────────────

/**
 * Read the token URI off-chain. Tries ERC-721 `tokenURI` first; on revert
 * (or any error whose message indicates an unsupported function), falls
 * back to ERC-1155 `uri`. Any *other* error surfaces as `EvmReadError`.
 */
async function readUri(
  client: ReturnType<typeof createPublicClient>,
  ref: TokenizedCreditRef,
  timeoutMs: number,
): Promise<string> {
  const address = ref.contractAddress as Address;
  const tokenId = parseTokenId(ref.tokenId, ref);

  let primaryError: unknown;
  try {
    const result = await withTimeout(
      client.readContract({
        address,
        abi: TOKEN_URI_ABI,
        functionName: 'tokenURI',
        args: [tokenId],
      }),
      timeoutMs,
      ref,
      'tokenURI',
    );
    return String(result);
  } catch (err) {
    primaryError = err;
    if (!isLikelyUnsupportedFunctionError(err)) {
      throw wrapRpcError('tokenURI read failed', err, ref);
    }
  }

  // ERC-1155 fallback.
  try {
    const result = await withTimeout(
      client.readContract({
        address,
        abi: TOKEN_URI_ABI,
        functionName: 'uri',
        args: [tokenId],
      }),
      timeoutMs,
      ref,
      'uri',
    );
    return substituteErc1155IdPlaceholder(String(result), tokenId);
  } catch (fallbackErr) {
    // Surface the FALLBACK error — usually more informative than the
    // first revert when both shapes fail. Attach the primary error in
    // the message for diagnostic context.
    throw wrapRpcError(
      `tokenURI + uri both failed (primary=${describeError(primaryError)})`,
      fallbackErr,
      ref,
    );
  }
}

function parseTokenId(raw: string, ref: TokenizedCreditRef): bigint {
  try {
    // viem's BigInt parsing tolerates decimal + hex (0x...).
    return BigInt(raw);
  } catch (err) {
    throw new EvmReadError(
      `tokenId must be a decimal or 0x-prefixed hex string, got "${raw}"`,
      ref.chain,
      ref.contractAddress,
      raw,
      err,
    );
  }
}

function isLikelyUnsupportedFunctionError(err: unknown): boolean {
  // Never retry our own typed timeout — that's a genuine network outage,
  // not an "ERC-721 contract is actually ERC-1155" signal.
  if (err instanceof EvmReadError && /timed out/i.test(err.message)) return false;
  const m = String((err as { message?: string })?.message ?? err ?? '');
  // viem surfaces `ContractFunctionExecutionError` whose `cause` is a
  // revert with `function does not exist` / `selector not found` /
  // `execution reverted`. Keep the check loose so we don't miss a
  // chain-specific phrasing, but exclude obvious non-revert phrasings
  // (timeout, network refused, DNS failure).
  if (/timed out|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|getaddrinfo/i.test(m)) return false;
  return /tokenURI|function does not exist|selector|reverted|execution reverted/i.test(m);
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return String(err);
}

function wrapRpcError(label: string, err: unknown, ref: TokenizedCreditRef): EvmReadError {
  if (err instanceof EvmReadError) return err;
  return new EvmReadError(
    `${label}: ${describeError(err)}`,
    ref.chain,
    ref.contractAddress,
    ref.tokenId,
    err,
  );
}

/**
 * ERC-1155 metadata URI may carry the `{id}` placeholder per the spec —
 * the client substitutes the 64-hex-char left-padded token id at the
 * point of resolution. Toucan + KlimaDAO follow this convention.
 */
function substituteErc1155IdPlaceholder(uri: string, tokenId: bigint): string {
  if (!uri.includes('{id}')) return uri;
  const hex = tokenId.toString(16).padStart(64, '0');
  return uri.split('{id}').join(hex);
}

// ─────────────────────────────────────────────────────────────────────
// URI resolution layer — ipfs:// + data:application/json + http(s)://
// ─────────────────────────────────────────────────────────────────────

async function resolveUri(
  uri: string,
  ipfsGateway: string,
  http: HttpTransport,
  timeoutMs: number,
  ref: TokenizedCreditRef,
): Promise<unknown> {
  if (!uri || uri.length === 0) {
    throw new EvmReadError(
      'tokenURI returned an empty string',
      ref.chain,
      ref.contractAddress,
      ref.tokenId,
    );
  }
  if (uri.startsWith('data:')) {
    return parseDataUri(uri, ref);
  }
  if (uri.startsWith('ipfs://')) {
    const cidPath = uri.slice('ipfs://'.length).replace(/^ipfs\//, '');
    const fetchUrl = `${ipfsGateway}${cidPath}`;
    return await fetchJson(http, fetchUrl, timeoutMs, ref, { ipfs: { cidOrUri: uri, gatewayUrl: fetchUrl } });
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return await fetchJson(http, uri, timeoutMs, ref);
  }
  // Some bridges return bare CIDs.
  if (/^[a-zA-Z0-9]{46,}$/.test(uri)) {
    const fetchUrl = `${ipfsGateway}${uri}`;
    return await fetchJson(http, fetchUrl, timeoutMs, ref, { ipfs: { cidOrUri: uri, gatewayUrl: fetchUrl } });
  }
  throw new EvmReadError(
    `Unsupported tokenURI scheme: ${uri.slice(0, 40)}`,
    ref.chain,
    ref.contractAddress,
    ref.tokenId,
  );
}

function parseDataUri(uri: string, ref: TokenizedCreditRef): unknown {
  // Two acceptable shapes:
  //   data:application/json,{"...":...}
  //   data:application/json;base64,eyJrZXkiOiJ2YWx1ZSJ9
  const comma = uri.indexOf(',');
  if (comma === -1) {
    throw new EvmReadError(
      'data: URI missing payload separator',
      ref.chain,
      ref.contractAddress,
      ref.tokenId,
    );
  }
  const header = uri.slice(0, comma).toLowerCase();
  const payload = uri.slice(comma + 1);
  if (!header.includes('application/json')) {
    throw new EvmReadError(
      `data: URI mime is not application/json (header=${header})`,
      ref.chain,
      ref.contractAddress,
      ref.tokenId,
    );
  }
  const decoded = header.includes(';base64') ? safeBase64Decode(payload) : safeDecodeUri(payload);
  try {
    return JSON.parse(decoded);
  } catch (err) {
    throw new EvmReadError(
      `data: URI JSON parse failed: ${describeError(err)}`,
      ref.chain,
      ref.contractAddress,
      ref.tokenId,
      err,
    );
  }
}

function safeBase64Decode(s: string): string {
  // Node >= 16 has `globalThis.atob`; fall back to Buffer just in case.
  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(s);
    }
  } catch {
    /* fall through */
  }
  interface NodeBufferLike {
    readonly from: (input: string, encoding: string) => { toString: (enc: string) => string };
  }
  const BufferCtor = (globalThis as { Buffer?: NodeBufferLike }).Buffer;
  if (BufferCtor && typeof BufferCtor.from === 'function') {
    return BufferCtor.from(s, 'base64').toString('utf8');
  }
  throw new Error('No base64 decoder available in this runtime');
}

function safeDecodeUri(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    // Allow raw JSON without percent-encoding too.
    return s;
  }
}

interface IpfsContext {
  readonly ipfs?: {
    readonly cidOrUri: string;
    readonly gatewayUrl: string;
  };
}

async function fetchJson(
  http: HttpTransport,
  url: string,
  timeoutMs: number,
  ref: TokenizedCreditRef,
  ctx: IpfsContext = {},
): Promise<unknown> {
  const opts: HttpRequestOptions = { timeoutMs };
  try {
    return await http.get(url, opts);
  } catch (err) {
    if (ctx.ipfs) {
      throw new IpfsResolutionError(
        `IPFS gateway fetch failed for ${ctx.ipfs.cidOrUri}: ${describeError(err)}`,
        ctx.ipfs.cidOrUri,
        ctx.ipfs.gatewayUrl,
        err,
      );
    }
    throw new EvmReadError(
      `HTTP fetch of tokenURI failed (${url}): ${describeError(err)}`,
      ref.chain,
      ref.contractAddress,
      ref.tokenId,
      err,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// Default HTTP transport — used when the caller does not inject one.
// Built on global `fetch` (Node 22+ has it; tests inject a mock so this
// path is exercised only in production composition roots).
// ─────────────────────────────────────────────────────────────────────

function defaultHttpTransport(): HttpTransport {
  return {
    async get(url, opts) {
      const controller = new AbortController();
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_RPC_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json', ...(opts?.headers ?? {}) },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${url}`);
        }
        return await res.json();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internals — generic timeout wrapper
// ─────────────────────────────────────────────────────────────────────

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  ref: TokenizedCreditRef,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new EvmReadError(
              `${label} RPC timed out after ${timeoutMs}ms`,
              ref.chain,
              ref.contractAddress,
              ref.tokenId,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`;
}
