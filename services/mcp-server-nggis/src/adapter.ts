/**
 * Deterministic mock adapter for `@bossnyumba/mcp-server-nggis`.
 * Production adapters (state-by-state REST clients keyed on stateCode)
 * land in Phase F.
 */

import type {
  NggisAdapter,
  PropertyMatch,
  SearchPropertyArgs,
  SearchPropertyResult,
  VerifyTitleDeedArgs,
  VerifyTitleDeedResult,
} from './types.js';

const REGISTRY_BY_STATE: Readonly<Record<string, string>> = Object.freeze({
  LA: 'LASRRA (Lagos State Real Estate Regulatory Authority)',
  FC: 'ABGIS (Abuja Geographic Information System)',
  KD: 'KADGIS (Kaduna Geographic Information System)',
  // Fallback for any other state code lives below.
});

function registryFor(stateCode: string): string {
  return (
    REGISTRY_BY_STATE[stateCode.toUpperCase()] ??
    `State Lands Registry (${stateCode.toUpperCase()})`
  );
}

export class MockNggisAdapter implements NggisAdapter {
  async verifyTitleDeed(
    args: VerifyTitleDeedArgs,
  ): Promise<VerifyTitleDeedResult> {
    // Deed shape policy: any non-empty alphanumeric string is "verified"
    // for the mock; if it contains the substring "DISPUTE" we flag an
    // encumbrance, and if it contains "FAKE" we reject.
    if (!/^[A-Za-z0-9-]{3,}$/.test(args.deedNumber)) {
      return Object.freeze({
        verified: false,
        registry: registryFor(args.stateCode),
        reason: 'invalid_deed_shape',
      });
    }
    if (args.deedNumber.toUpperCase().includes('FAKE')) {
      return Object.freeze({
        verified: false,
        registry: registryFor(args.stateCode),
        reason: 'deed_not_found',
      });
    }
    const encumbrances: ReadonlyArray<string> =
      args.deedNumber.toUpperCase().includes('DISPUTE')
        ? Object.freeze(['pending_litigation'])
        : Object.freeze([]);
    return Object.freeze({
      verified: true,
      registry: registryFor(args.stateCode),
      currentOwner: `Mock Owner #${args.deedNumber.slice(-3)}`,
      registeredAt: '2020-01-01T00:00:00Z',
      encumbrances,
    });
  }

  async searchProperty(args: SearchPropertyArgs): Promise<SearchPropertyResult> {
    const limit = args.limit ?? 10;
    const reg = registryFor(args.stateCode);
    const matches: PropertyMatch[] = [];
    for (let i = 0; i < Math.min(3, limit); i += 1) {
      matches.push(
        Object.freeze({
          deedNumber: `${args.stateCode.toUpperCase()}-${1000 + i}-${args.query.slice(0, 3).toUpperCase() || 'PRP'}`,
          address: `${args.query} Plot ${i + 1}, ${args.stateCode.toUpperCase()} State`,
          registry: reg,
          status: 'active' as const,
        }),
      );
    }
    return Object.freeze({ matches: Object.freeze(matches) });
  }
}

/** Production adapter stub — Phase F wires per-state REST clients. */
export class NggisFederatedAdapter implements NggisAdapter {
  async verifyTitleDeed(
    _args: VerifyTitleDeedArgs,
  ): Promise<VerifyTitleDeedResult> {
    throw new Error(
      'NggisFederatedAdapter.verifyTitleDeed not yet wired — Phase F.',
    );
  }
  async searchProperty(
    _args: SearchPropertyArgs,
  ): Promise<SearchPropertyResult> {
    throw new Error(
      'NggisFederatedAdapter.searchProperty not yet wired — Phase F.',
    );
  }
}
