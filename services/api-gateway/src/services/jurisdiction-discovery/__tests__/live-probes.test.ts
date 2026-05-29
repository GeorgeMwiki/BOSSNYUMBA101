/**
 * JC-9 — 8-country live discovery probes (real-estate edition).
 *
 * Verifies the discovery pipeline surfaces real housing / tribunal /
 * revenue / data-protection authorities for the 8 growth-market
 * jurisdictions BossNyumba targets next:
 *
 *   Ghana / Rwanda / Botswana / Morocco / Egypt / Ethiopia / Senegal /
 *   India.
 *
 * Each probe seeds the web-search adapter with publicly-known
 * regulator names (Ghana Rent Control Department, Rwanda Housing
 * Authority, etc.) and asserts:
 *
 *   - The discovery profile recovers the country code + name.
 *   - The synthesizer extracts at least one named regulator from the
 *     hits (so Mr. Mwikila has a concrete anchor).
 *   - Validity score is at least 0.55 (single-source confidence).
 *   - Source citations make it back to the result with kind='web_search'.
 *
 * These probes are HERMETIC — no real network call. They mirror the
 * shape of the response the brain's web-search tool would return at
 * runtime (the integration with the actual tool is exercised by the
 * brain-tools tests). The point is to prove that GIVEN realistic
 * input, Mr. Mwikila NEVER falls through to "I don't know".
 *
 * Ported from Borjie — 8 mining jurisdictions (Peru/Mongolia/DRC/
 * Ghana/Zambia/Botswana/Argentina/Kazakhstan) swapped to 8
 * real-estate growth markets above.
 */

import { describe, expect, it } from 'vitest';

import { createJurisdictionDiscoveryService } from '../service.js';
import type {
  BrainWebSearchAdapter,
  CorpusSearchAdapter,
  DiscoveryCacheAdapter,
} from '../types.js';

// ─── Fake adapters ────────────────────────────────────────────────────

function fakeWeb(
  hits: ReadonlyArray<{ url: string; title: string; snippet: string }>,
): BrainWebSearchAdapter {
  return {
    async search() {
      return hits;
    },
  };
}

function emptyCorpus(): CorpusSearchAdapter {
  return {
    async search() {
      return [];
    },
  };
}

function nullCache(): DiscoveryCacheAdapter {
  return {
    async get() {
      return null;
    },
    async put() {
      // no-op for hermetic probes.
    },
  };
}

// ─── Country probes ───────────────────────────────────────────────────

const PROBES: ReadonlyArray<{
  readonly label: string;
  readonly query: string;
  readonly expectCode: string;
  readonly expectName: string;
  readonly hits: ReadonlyArray<{ url: string; title: string; snippet: string }>;
  /** Regulator substring we expect the synthesizer to surface. */
  readonly expectRegulatorMatch: RegExp;
}> = [
  {
    label: 'Ghana',
    query: 'Ghana',
    expectCode: 'GH',
    expectName: 'Ghana',
    hits: [
      {
        url: 'https://www.mlnr.gov.gh/rent-control',
        title:
          'Ghana Rent Control Department — Ministry of Works and Housing',
        snippet:
          'The Rent Control Department under the Ministry of Works and Housing administers the Ghana Landlord and Tenant Act. Currency GHS.',
      },
      {
        url: 'https://gra.gov.gh',
        title: 'Ghana Revenue Authority (GRA) — Rental Income Tax',
        snippet:
          'GRA collects rental income tax on residential and commercial properties.',
      },
    ],
    expectRegulatorMatch: /Rent|Ministry|Revenue|Department|GRA/i,
  },
  {
    label: 'Rwanda',
    query: 'Rwanda',
    expectCode: 'RW',
    expectName: 'Rwanda',
    hits: [
      {
        url: 'https://www.minaloc.gov.rw',
        title:
          'Ministry of Local Government Rwanda — Rental Housing oversight',
        snippet:
          'The Rwanda Housing Authority (RHA) oversees the residential rental market. Currency RWF.',
      },
    ],
    expectRegulatorMatch: /Housing|Ministry|Authority|RHA/i,
  },
  {
    label: 'Botswana',
    query: 'Botswana',
    expectCode: 'BW',
    expectName: 'Botswana',
    hits: [
      {
        url: 'https://www.gov.bw/ministries/lands-housing',
        title:
          'Botswana Ministry of Lands and Water Affairs — Housing Department',
        snippet:
          'The Ministry of Lands and Water Affairs hosts the Department of Lands and Housing in Botswana. Currency BWP.',
      },
    ],
    expectRegulatorMatch: /Lands|Housing|Department|Ministry/i,
  },
  {
    label: 'Morocco',
    query: 'Morocco',
    expectCode: 'MA',
    expectName: 'Morocco',
    hits: [
      {
        url: 'https://www.mhpv.gov.ma',
        title:
          'Ministère de l\'Aménagement du Territoire National, de l\'Urbanisme, de l\'Habitat et de la Politique de la Ville',
        snippet:
          'Le Ministère administre la politique du logement et la réglementation locative au Maroc. Currency MAD.',
      },
    ],
    expectRegulatorMatch: /Ministry|Ministère|Housing|Habitat|Urban/i,
  },
  {
    label: 'Egypt',
    query: 'Egypt',
    expectCode: 'EG',
    expectName: 'Egypt',
    hits: [
      {
        url: 'https://www.moh.gov.eg',
        title:
          'Egypt Ministry of Housing Utilities and Urban Communities — Rental Law',
        snippet:
          'The Ministry of Housing administers the New Rental Law and rental dispute mediation. Currency EGP.',
      },
    ],
    expectRegulatorMatch: /Ministry|Housing|Urban|Rental/i,
  },
  {
    label: 'Ethiopia',
    query: 'Ethiopia',
    expectCode: 'ET',
    expectName: 'Ethiopia',
    hits: [
      {
        url: 'https://www.mudc.gov.et',
        title:
          'Ethiopia Ministry of Urban Development and Construction — Housing Authority',
        snippet:
          'The Ministry of Urban Development and Construction supervises residential rental policy. Currency ETB.',
      },
    ],
    expectRegulatorMatch: /Ministry|Urban|Housing|Development|Construction/i,
  },
  {
    label: 'Senegal',
    query: 'Senegal',
    expectCode: 'SN',
    expectName: 'Senegal',
    hits: [
      {
        url: 'https://www.servicepublic.gouv.sn/habitat',
        title:
          'Sénégal Ministère de l\'Urbanisme du Logement et de l\'Hygiène publique — Direction Habitat',
        snippet:
          'La Direction Habitat administre la politique de logement et la médiation des litiges locatifs au Sénégal. Currency XOF.',
      },
    ],
    expectRegulatorMatch: /Ministère|Direction|Habitat|Urban|Logement|Ministry/i,
  },
  {
    label: 'India',
    query: 'India',
    expectCode: 'IN',
    expectName: 'India',
    hits: [
      {
        url: 'https://mohua.gov.in',
        title:
          'India Ministry of Housing and Urban Affairs — Model Tenancy Act 2021',
        snippet:
          'The Ministry of Housing and Urban Affairs and state Rent Authorities administer the Model Tenancy Act. Currency INR.',
      },
    ],
    expectRegulatorMatch: /Ministry|Housing|Urban|Authority|Tenancy/i,
  },
];

// ─── Tests ────────────────────────────────────────────────────────────

describe("JC-9 — 8 live discovery probes (Mr. Mwikila NEVER says I don't know)", () => {
  for (const probe of PROBES) {
    it(`surfaces real regulator info for ${probe.label} (${probe.expectCode})`, async () => {
      const svc = createJurisdictionDiscoveryService({
        webSearch: fakeWeb(probe.hits),
        corpus: emptyCorpus(),
        cache: nullCache(),
      });
      const result = await svc.discover(probe.query);

      // Country resolution.
      expect(result.profile.countryCode).toBe(probe.expectCode);
      expect(result.profile.countryName).toBe(probe.expectName);

      // Pipeline ran end-to-end (not the seeded short-circuit).
      expect(result.origin).toBe('discovered');

      // At least one regulator candidate; one should match the
      // expected substring.
      expect(result.profile.regulators.length).toBeGreaterThan(0);
      const haystack = result.profile.regulators
        .map((r) => r.name)
        .join(' ');
      expect(haystack).toMatch(probe.expectRegulatorMatch);

      // Single-source minimum confidence (web only).
      expect(result.profile.validityScore).toBeGreaterThanOrEqual(0.55);
      expect(result.lowConfidence).toBe(false);

      // Sources travelled through with the right kind.
      expect(result.sources.length).toBeGreaterThan(0);
      expect(
        result.sources.some((s) => s.kind === 'web_search'),
      ).toBe(true);
    });
  }
});
