/**
 * Tokenized-credit verifier tests — mocked EvmReader + mocked Verra client.
 *
 * Exercises:
 *   - Happy-path Toucan-style metadata → underlying serial extracted
 *   - Double-counting: same serial under two tokens → flagged
 *   - Retired underlying → flagged via Verra cross-check
 *   - Unparseable tokenURI → narrative carries the parse failure
 */

import { describe, expect, it } from 'vitest';
import { createTokenizedCreditVerifier } from '../tokenization/verifier.js';
import { createVerraClient } from '../verra/client.js';
import type {
  EvmReader,
  HttpTransport,
  TokenizedCreditRef,
} from '../types.js';
import { SAMPLE_ISSUANCE_LIST, SAMPLE_SINGLE_PROJECT, SAMPLE_TOUCAN_METADATA } from './fixtures.js';

function transportFor(responses: ReadonlyArray<unknown>): HttpTransport {
  const iter = responses[Symbol.iterator]();
  return {
    async get() {
      const next = iter.next();
      if (next.done) throw new Error('http: no more responses');
      return next.value;
    },
  };
}

function evmReader(uri: unknown): EvmReader {
  return {
    async tokenURI() {
      return uri;
    },
  };
}

const REF: TokenizedCreditRef = {
  chain: 'polygon',
  contractAddress: '0xabc1234567890def',
  tokenId: '1',
};

const REF_B: TokenizedCreditRef = {
  chain: 'polygon',
  contractAddress: '0xdef1234567890abc',
  tokenId: '2',
};

describe('createTokenizedCreditVerifier — happy path', () => {
  it('extracts the underlying serial from Toucan-style metadata', async () => {
    const verra = createVerraClient({
      transport: transportFor([SAMPLE_SINGLE_PROJECT, SAMPLE_ISSUANCE_LIST]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader(SAMPLE_TOUCAN_METADATA),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.metadata.underlyingSerial).toBe(SAMPLE_TOUCAN_METADATA.serialNumber);
    expect(r.metadata.projectId).toBe('1234');
    expect(r.metadata.issuer).toBe('Toucan');
    expect(r.doubleCountFlag).toBe(false);
  });

  it('cross-references the Verra registry for a project hit', async () => {
    const verra = createVerraClient({
      transport: transportFor([SAMPLE_SINGLE_PROJECT, SAMPLE_ISSUANCE_LIST]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader(SAMPLE_TOUCAN_METADATA),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.registryMatch).not.toBeNull();
    expect(r.registryMatch!.country).toBe('UG');
  });

  it('narrative carries the verification chain', async () => {
    const verra = createVerraClient({
      transport: transportFor([SAMPLE_SINGLE_PROJECT, SAMPLE_ISSUANCE_LIST]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader(SAMPLE_TOUCAN_METADATA),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.narrative.join('\n')).toContain('Reading tokenURI');
    expect(r.narrative.join('\n')).toContain('Underlying serial=');
    expect(r.narrative.join('\n')).toContain('Registry match');
  });

  it('reports retired underlying serial', async () => {
    const issuanceListWithRetired = {
      issuances: [
        {
          projectId: '1234',
          serialNumber: SAMPLE_TOUCAN_METADATA.serialNumber,
          vintage: 2024,
          tonnes: 10_000,
          issuanceDate: '2025-09-10',
          retired: true,
        },
      ],
    };
    const verra = createVerraClient({
      transport: transportFor([SAMPLE_SINGLE_PROJECT, issuanceListWithRetired]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader(SAMPLE_TOUCAN_METADATA),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.underlyingRetired).toBe(true);
  });
});

describe('createTokenizedCreditVerifier — double counting', () => {
  it('flags the second token that exposes the same serial', async () => {
    const verra = createVerraClient({
      transport: transportFor([
        SAMPLE_SINGLE_PROJECT, SAMPLE_ISSUANCE_LIST,        // first verify
        SAMPLE_SINGLE_PROJECT, SAMPLE_ISSUANCE_LIST,        // second verify
      ]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader(SAMPLE_TOUCAN_METADATA),
      verra,
    });
    const first = await verifier.verifyTokenizedCredit(REF);
    const second = await verifier.verifyTokenizedCredit(REF_B);
    expect(first.doubleCountFlag).toBe(false);
    expect(second.doubleCountFlag).toBe(true);
    expect(second.narrative.join('\n')).toContain('DOUBLE-COUNT');
  });

  it('respects a pre-seeded seenSerials set', async () => {
    const verra = createVerraClient({
      transport: transportFor([SAMPLE_SINGLE_PROJECT, SAMPLE_ISSUANCE_LIST]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader(SAMPLE_TOUCAN_METADATA),
      verra,
      seenSerials: new Set([SAMPLE_TOUCAN_METADATA.serialNumber]),
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.doubleCountFlag).toBe(true);
  });
});

describe('createTokenizedCreditVerifier — degraded payloads', () => {
  it('parses Toucan vintage-token-id when serialNumber is missing', async () => {
    const verra = createVerraClient({
      transport: transportFor([
        { issuances: [] },                            // verifyCredit lookup
      ]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader({
        projectVintageTokenId: 'TCO2-VCS-1234-2024',
        issuer: 'Toucan',
      }),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.metadata.underlyingSerial).toBe('TCO2-VCS-1234-2024');
  });

  it('parses underlying nested-object shape', async () => {
    const verra = createVerraClient({
      transport: transportFor([SAMPLE_SINGLE_PROJECT, { issuances: [] }]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader({
        issuer: 'KlimaDAO',
        underlying: {
          serialNumber: 'NESTED-SERIAL-001',
          projectId: '9012',
          vintage: 2024,
        },
      }),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.metadata.underlyingSerial).toBe('NESTED-SERIAL-001');
    expect(r.metadata.projectId).toBe('9012');
  });

  it('returns a stub result with empty serial when tokenURI is junk', async () => {
    const verra = createVerraClient({
      transport: transportFor([]),
      sleep: async () => {},
    });
    const verifier = createTokenizedCreditVerifier({
      evm: evmReader('not-an-object'),
      verra,
    });
    const r = await verifier.verifyTokenizedCredit(REF);
    expect(r.metadata.underlyingSerial).toBe('');
    expect(r.metadata.issuer).toBe('Unknown');
    expect(r.narrative.some((n) => n.includes('parse failed'))).toBe(true);
  });
});
