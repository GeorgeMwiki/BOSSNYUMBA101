/**
 * evm-readers tests — production `EvmReader` backed by viem.
 *
 * `viem` is mocked at the import boundary so the suite stays offline +
 * deterministic. Each test wires up:
 *
 *   - a `readContract` stub that the viem mock returns
 *   - (when needed) an `HttpTransport` stub for the IPFS gateway leg
 *
 * Coverage (≥ 12 tests):
 *   - ERC-721 happy path (https tokenURI)
 *   - ERC-1155 fallback when ERC-721 reverts
 *   - data:application/json inline metadata (raw + base64)
 *   - ipfs:// gateway resolution (default + override)
 *   - bare CID resolution
 *   - http:// + https:// scheme handling
 *   - RPC timeout surfaces typed EvmReadError
 *   - RPC network error surfaces typed EvmReadError
 *   - IPFS gateway failure surfaces typed IpfsResolutionError
 *   - empty tokenURI surfaces EvmReadError
 *   - unsupported scheme surfaces EvmReadError
 *   - tokenId parse failure surfaces EvmReadError
 *   - unsupported chain throws at construction time
 *   - ERC-1155 `{id}` placeholder substitution
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────────
// Mock viem so the suite never opens a socket.
//
// `vi.mock` is hoisted to the top of the file before any imports — and
// any closure it references must be ALSO hoisted via `vi.hoisted`.
// ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const readContractMock = vi.fn();
  const createPublicClientMock = vi.fn(() => ({ readContract: readContractMock }));
  const httpMock = vi.fn(() => 'mock-transport');
  const parseAbiMock = vi.fn((sigs: ReadonlyArray<string>) =>
    sigs.map((sig) => ({ type: 'function', signature: sig })),
  );
  const polygonChain = { id: 137, name: 'Polygon' };
  const celoChain = { id: 42220, name: 'Celo' };
  const ethereumChain = { id: 1, name: 'Ethereum' };
  const baseChain = { id: 8453, name: 'Base' };
  return {
    readContractMock,
    createPublicClientMock,
    httpMock,
    parseAbiMock,
    polygonChain,
    celoChain,
    ethereumChain,
    baseChain,
  };
});

vi.mock('viem', () => ({
  createPublicClient: mocks.createPublicClientMock,
  http: mocks.httpMock,
  parseAbi: mocks.parseAbiMock,
}));

vi.mock('viem/chains', () => ({
  polygon: mocks.polygonChain,
  celo: mocks.celoChain,
  mainnet: mocks.ethereumChain,
  base: mocks.baseChain,
}));

// Local aliases so the rest of the file reads naturally.
const {
  readContractMock,
  createPublicClientMock,
  httpMock,
  parseAbiMock,
  polygonChain,
  celoChain,
  ethereumChain,
  baseChain,
} = mocks;

// `vi.mock` calls are hoisted above static imports so the static
// imports below pick up the mocked module.
import {
  createViemEvmReader,
  DEFAULT_IPFS_GATEWAY,
  DEFAULT_RPC_TIMEOUT_MS,
} from '../evm-readers.js';
import { EvmReadError, IpfsResolutionError } from '../../verra/errors.js';
import type { HttpTransport, TokenizedCreditRef } from '../../types.js';

const POLYGON_REF: TokenizedCreditRef = {
  chain: 'polygon',
  contractAddress: '0xabc1234567890abcdef1234567890abcdef12345',
  tokenId: '42',
};

function makeTransport(
  responses: ReadonlyArray<unknown | Error>,
): { transport: HttpTransport; calls: Array<{ url: string; timeoutMs?: number }> } {
  const calls: Array<{ url: string; timeoutMs?: number }> = [];
  const iter = responses[Symbol.iterator]();
  return {
    transport: {
      async get(url, opts) {
        calls.push({ url, timeoutMs: opts?.timeoutMs ?? undefined });
        const next = iter.next();
        if (next.done) throw new Error('transport: no more queued responses');
        if (next.value instanceof Error) throw next.value;
        return next.value;
      },
    },
    calls,
  };
}

beforeEach(() => {
  readContractMock.mockReset();
  createPublicClientMock.mockClear();
  httpMock.mockClear();
  parseAbiMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createViemEvmReader — construction', () => {
  it('wires viem.createPublicClient with the polygon chain object', () => {
    createViemEvmReader({ chain: 'polygon', rpcUrl: 'https://rpc.example/polygon' });
    expect(createPublicClientMock).toHaveBeenCalledTimes(1);
    const arg = createPublicClientMock.mock.calls[0]![0] as { chain: unknown };
    expect(arg.chain).toBe(polygonChain);
  });

  it('wires viem.createPublicClient with the celo chain object', () => {
    createViemEvmReader({ chain: 'celo', rpcUrl: 'https://rpc.example/celo' });
    const arg = createPublicClientMock.mock.calls[0]![0] as { chain: unknown };
    expect(arg.chain).toBe(celoChain);
  });

  it('maps the "ethereum" alias to viem.mainnet', () => {
    createViemEvmReader({ chain: 'ethereum', rpcUrl: 'https://rpc.example/eth' });
    const arg = createPublicClientMock.mock.calls[0]![0] as { chain: unknown };
    expect(arg.chain).toBe(ethereumChain);
  });

  it('wires viem.createPublicClient with the base chain object', () => {
    createViemEvmReader({ chain: 'base', rpcUrl: 'https://rpc.example/base' });
    const arg = createPublicClientMock.mock.calls[0]![0] as { chain: unknown };
    expect(arg.chain).toBe(baseChain);
  });

  it('passes the timeout through to viem.http', () => {
    createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example/polygon',
      timeoutMs: 5_000,
    });
    expect(httpMock).toHaveBeenCalledWith('https://rpc.example/polygon', { timeout: 5_000 });
  });

  it('uses DEFAULT_RPC_TIMEOUT_MS when no timeout is supplied', () => {
    createViemEvmReader({ chain: 'polygon', rpcUrl: 'https://rpc.example' });
    expect(httpMock).toHaveBeenCalledWith('https://rpc.example', {
      timeout: DEFAULT_RPC_TIMEOUT_MS,
    });
  });

  it('throws on an unsupported chain id', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createViemEvmReader({ chain: 'arbitrum' as any, rpcUrl: 'https://x.test' }),
    ).toThrow(/unsupported chain/i);
  });
});

describe('createViemEvmReader — ERC-721 happy path', () => {
  it('returns parsed JSON when tokenURI resolves to an https URL', async () => {
    const metadata = { serialNumber: 'VCS-1234-1', projectId: '1234' };
    const { transport, calls } = makeTransport([metadata]);
    readContractMock.mockResolvedValueOnce('https://meta.example/1');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    const result = await reader.tokenURI(POLYGON_REF);
    expect(result).toEqual(metadata);
    expect(readContractMock).toHaveBeenCalledTimes(1);
    const arg = readContractMock.mock.calls[0]![0] as {
      address: string;
      functionName: string;
      args: ReadonlyArray<bigint>;
    };
    expect(arg.functionName).toBe('tokenURI');
    expect(arg.args[0]).toBe(42n);
    expect(calls[0]!.url).toBe('https://meta.example/1');
  });

  it('passes the read timeout to the IPFS transport', async () => {
    const { transport, calls } = makeTransport([{ serialNumber: 'X' }]);
    readContractMock.mockResolvedValueOnce('https://meta.example/x');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
      timeoutMs: 7_500,
    });
    await reader.tokenURI(POLYGON_REF);
    expect(calls[0]!.timeoutMs).toBe(7_500);
  });
});

describe('createViemEvmReader — ERC-1155 fallback', () => {
  it('falls back to uri(uint256) when tokenURI reverts', async () => {
    readContractMock
      .mockRejectedValueOnce(new Error('execution reverted: tokenURI not implemented'))
      .mockResolvedValueOnce('https://meta.example/1155');
    const { transport } = makeTransport([{ serialNumber: 'TCO2-VCS-9' }]);
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    const result = await reader.tokenURI(POLYGON_REF);
    expect(result).toEqual({ serialNumber: 'TCO2-VCS-9' });
    expect(readContractMock).toHaveBeenCalledTimes(2);
    const second = readContractMock.mock.calls[1]![0] as { functionName: string };
    expect(second.functionName).toBe('uri');
  });

  it('substitutes the ERC-1155 {id} placeholder with the 64-hex token id', async () => {
    readContractMock
      .mockRejectedValueOnce(new Error('execution reverted'))
      // {id} → tokenId=42 → padStart(64,'0') of "2a" = 62 zeros + "2a"
      .mockResolvedValueOnce('https://meta.example/{id}.json');
    const { transport, calls } = makeTransport([{ serialNumber: 'PAD' }]);
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    await reader.tokenURI(POLYGON_REF);
    const expected = `https://meta.example/${'0'.repeat(62)}2a.json`;
    expect(calls[0]!.url).toBe(expected);
  });

  it('surfaces EvmReadError when BOTH tokenURI and uri fail', async () => {
    readContractMock
      .mockRejectedValueOnce(new Error('execution reverted'))
      .mockRejectedValueOnce(new Error('execution reverted on uri too'));
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    // Single call — assert both shape + message in one error capture.
    try {
      await reader.tokenURI(POLYGON_REF);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EvmReadError);
      expect((err as Error).message).toMatch(/primary=/);
      expect((err as Error).message).toMatch(/uri too/);
    }
  });
});

describe('createViemEvmReader — IPFS URI resolution', () => {
  it('resolves ipfs:// via the default gateway', async () => {
    const metadata = { serialNumber: 'IPFS-1', issuer: 'Toucan' };
    const { transport, calls } = makeTransport([metadata]);
    readContractMock.mockResolvedValueOnce('ipfs://bafyabc123/meta.json');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    const result = await reader.tokenURI(POLYGON_REF);
    expect(result).toEqual(metadata);
    expect(calls[0]!.url).toBe(`${DEFAULT_IPFS_GATEWAY}bafyabc123/meta.json`);
  });

  it('respects an override IPFS gateway', async () => {
    const { transport, calls } = makeTransport([{ serialNumber: 'X' }]);
    readContractMock.mockResolvedValueOnce('ipfs://bafyx');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      ipfsGateway: 'https://cf-ipfs.example/ipfs/',
      httpTransport: transport,
    });
    await reader.tokenURI(POLYGON_REF);
    expect(calls[0]!.url).toBe('https://cf-ipfs.example/ipfs/bafyx');
  });

  it('resolves bare CIDs through the IPFS gateway', async () => {
    const { transport, calls } = makeTransport([{ serialNumber: 'CID-ONLY' }]);
    readContractMock.mockResolvedValueOnce('bafybeicid7uw3rpwfqgz5gqltlhjyhpsd5xhqv6e3v7m6lvxqx6dyu7zqe');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    await reader.tokenURI(POLYGON_REF);
    expect(calls[0]!.url).toContain('bafybeicid7uw3rpwfqgz5gqltlhjyhpsd5xhqv6e3v7m6lvxqx6dyu7zqe');
  });

  it('surfaces IpfsResolutionError when the gateway fetch fails', async () => {
    const { transport } = makeTransport([new Error('HTTP 504 for gateway')]);
    readContractMock.mockResolvedValueOnce('ipfs://bafyabc');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toBeInstanceOf(IpfsResolutionError);
  });

  it('IpfsResolutionError carries the cid + gateway url', async () => {
    const { transport } = makeTransport([new Error('boom')]);
    readContractMock.mockResolvedValueOnce('ipfs://bafyz1/x.json');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      httpTransport: transport,
    });
    try {
      await reader.tokenURI(POLYGON_REF);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(IpfsResolutionError);
      expect((err as InstanceType<typeof IpfsResolutionError>).cidOrUri).toBe('ipfs://bafyz1/x.json');
      expect((err as InstanceType<typeof IpfsResolutionError>).gatewayUrl).toBe(
        `${DEFAULT_IPFS_GATEWAY}bafyz1/x.json`,
      );
    }
  });
});

describe('createViemEvmReader — data: URI', () => {
  it('parses inline application/json payload', async () => {
    readContractMock.mockResolvedValueOnce('data:application/json,{"serialNumber":"INLINE-1"}');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    const result = await reader.tokenURI(POLYGON_REF);
    expect(result).toEqual({ serialNumber: 'INLINE-1' });
  });

  it('parses inline base64 application/json payload', async () => {
    const payload = Buffer.from('{"serialNumber":"B64-1"}', 'utf8').toString('base64');
    readContractMock.mockResolvedValueOnce(`data:application/json;base64,${payload}`);
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    const result = await reader.tokenURI(POLYGON_REF);
    expect(result).toEqual({ serialNumber: 'B64-1' });
  });

  it('handles percent-encoded JSON in data URIs', async () => {
    const json = encodeURIComponent('{"serialNumber":"PCT-1"}');
    readContractMock.mockResolvedValueOnce(`data:application/json,${json}`);
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    const result = await reader.tokenURI(POLYGON_REF);
    expect(result).toEqual({ serialNumber: 'PCT-1' });
  });

  it('rejects non-JSON data URIs as EvmReadError', async () => {
    readContractMock.mockResolvedValueOnce('data:text/plain,hello');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toBeInstanceOf(EvmReadError);
  });

  it('rejects data URIs without a payload separator', async () => {
    readContractMock.mockResolvedValueOnce('data:application/json');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toBeInstanceOf(EvmReadError);
  });

  it('rejects malformed JSON inside a data URI', async () => {
    readContractMock.mockResolvedValueOnce('data:application/json,{not-json}');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toThrow(/JSON parse failed/i);
  });
});

describe('createViemEvmReader — error surfaces', () => {
  it('surfaces RPC errors that are NOT revert-shaped as EvmReadError', async () => {
    readContractMock.mockRejectedValueOnce(new Error('Network refused (ECONNREFUSED)'));
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toBeInstanceOf(EvmReadError);
  });

  it('EvmReadError carries chain + contract + tokenId for diagnostics', async () => {
    readContractMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    try {
      await reader.tokenURI(POLYGON_REF);
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EvmReadError);
      const ev = err as InstanceType<typeof EvmReadError>;
      expect(ev.chain).toBe('polygon');
      expect(ev.contractAddress).toBe(POLYGON_REF.contractAddress);
      expect(ev.tokenId).toBe('42');
    }
  });

  it('surfaces an empty tokenURI as EvmReadError', async () => {
    readContractMock.mockResolvedValueOnce('');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toThrow(/empty string/);
  });

  it('surfaces an unsupported scheme as EvmReadError', async () => {
    readContractMock.mockResolvedValueOnce('ar://arweave-cid/meta.json');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toThrow(/Unsupported tokenURI scheme/);
  });

  it('rejects a non-numeric tokenId as EvmReadError', async () => {
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await expect(
      reader.tokenURI({ ...POLYGON_REF, tokenId: 'not-a-number' }),
    ).rejects.toThrow(/tokenId must be a decimal/);
  });

  it('surfaces RPC timeout as EvmReadError', async () => {
    // Never resolves — the wrapper's setTimeout fires first.
    readContractMock.mockImplementationOnce(() => new Promise(() => {}));
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
      timeoutMs: 25,
    });
    await expect(reader.tokenURI(POLYGON_REF)).rejects.toThrow(/timed out/i);
  });
});

describe('createViemEvmReader — token id formats', () => {
  it('accepts hex-prefixed token ids', async () => {
    readContractMock.mockResolvedValueOnce('data:application/json,{"serialNumber":"HEX-1"}');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    const result = await reader.tokenURI({ ...POLYGON_REF, tokenId: '0x2a' });
    expect(result).toEqual({ serialNumber: 'HEX-1' });
    // 0x2a == 42 — same bigint as the decimal happy path.
    const arg = readContractMock.mock.calls[0]![0] as { args: ReadonlyArray<bigint> };
    expect(arg.args[0]).toBe(42n);
  });

  it('handles very large token ids (uint256 range)', async () => {
    const largeId = (2n ** 200n).toString();
    readContractMock.mockResolvedValueOnce('data:application/json,{"serialNumber":"BIG"}');
    const reader = createViemEvmReader({
      chain: 'polygon',
      rpcUrl: 'https://rpc.example',
    });
    await reader.tokenURI({ ...POLYGON_REF, tokenId: largeId });
    const arg = readContractMock.mock.calls[0]![0] as { args: ReadonlyArray<bigint> };
    expect(arg.args[0]).toBe(2n ** 200n);
  });
});
