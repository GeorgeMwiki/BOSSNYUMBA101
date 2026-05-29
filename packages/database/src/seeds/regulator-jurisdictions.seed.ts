/**
 * World-scale real-estate regulator jurisdictions seed.
 *
 * Tenant-AGNOSTIC catalogue — regulators publish the same authority
 * list to every operator. The seeder is idempotent via the unique
 * index (regulator_set, slug).
 *
 * Country coverage (9 sets):
 *   TZ — Tanzania  (housing authority, planning, property tax)
 *   KE — Kenya     (rent tribunal, lands ministry, NCA)
 *   UG — Uganda    (lands ministry, KCCA, URA property tax)
 *   NG — Nigeria   (Lagos Tenancy Law board, FIRS, MOFEC)
 *   ZA — South Africa (Rental Housing Tribunal, POPI commission)
 *   UK — United Kingdom (Property Ombudsman, deposit schemes, councils)
 *   US — United States (local landlord-tenant boards — federal anchor)
 *   AU — Australia (NSW Tenancy Tribunal, ATO, state building safety)
 *   generic — fallback for any other jurisdiction (light, advisory)
 *
 * Bilingual: each row carries `name_en` + `name_local` (sw/fr/pt/es/af).
 *
 * Companion to migration 0277.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { regulatorJurisdictions } from '../schemas/regulator-jurisdictions.schema.js';

interface SeedRow {
  readonly countryCode: string;
  readonly nameEn: string;
  readonly nameLocal: string | null;
  readonly slug: string;
  readonly regulatorSet:
    | 'TZ-set'
    | 'KE-set'
    | 'UG-set'
    | 'NG-set'
    | 'ZA-set'
    | 'UK-set'
    | 'US-set'
    | 'AU-set'
    | 'generic';
  readonly mandate:
    | 'tenancy-tribunal'
    | 'housing-authority'
    | 'building-safety'
    | 'property-tax'
    | 'land-registry'
    | 'planning-permission'
    | 'rental-protection'
    | 'hoa-strata'
    | 'tenant-rights'
    | 'data-protection'
    | 'generic';
  readonly contactUrl: string | null;
}

export const REGULATOR_JURISDICTION_SEED: readonly SeedRow[] = [
  // ─── TZ — Tanzania ─────────────────────────────────────────────────
  {
    countryCode: 'TZ',
    nameEn: 'Ministry of Lands, Housing and Human Settlements Development',
    nameLocal: 'Wizara ya Ardhi, Nyumba na Maendeleo ya Makazi',
    slug: 'mlhhsd-tz',
    regulatorSet: 'TZ-set',
    mandate: 'land-registry',
    contactUrl: 'https://www.lands.go.tz/',
  },
  {
    countryCode: 'TZ',
    nameEn: 'Rent Restriction Board',
    nameLocal: 'Bodi ya Udhibiti wa Pango',
    slug: 'rrb-tz',
    regulatorSet: 'TZ-set',
    mandate: 'tenancy-tribunal',
    contactUrl: null,
  },
  {
    countryCode: 'TZ',
    nameEn: 'Tanzania Revenue Authority — Property Tax',
    nameLocal: 'Mamlaka ya Mapato Tanzania — Kodi ya Ardhi',
    slug: 'tra-property-tz',
    regulatorSet: 'TZ-set',
    mandate: 'property-tax',
    contactUrl: 'https://www.tra.go.tz/',
  },
  {
    countryCode: 'TZ',
    nameEn: 'Personal Data Protection Commission',
    nameLocal: 'Kamisheni ya Ulinzi wa Taarifa Binafsi',
    slug: 'pdpc-tz',
    regulatorSet: 'TZ-set',
    mandate: 'data-protection',
    contactUrl: 'https://pdpc.go.tz/',
  },

  // ─── KE — Kenya ────────────────────────────────────────────────────
  {
    countryCode: 'KE',
    nameEn: 'Business Premises Rent Tribunal',
    nameLocal: 'Mahakama ya Pango la Biashara',
    slug: 'bprt-ke',
    regulatorSet: 'KE-set',
    mandate: 'tenancy-tribunal',
    contactUrl: 'https://www.judiciary.go.ke/',
  },
  {
    countryCode: 'KE',
    nameEn: 'Rent Restriction Tribunal',
    nameLocal: 'Mahakama ya Udhibiti wa Pango',
    slug: 'rrt-ke',
    regulatorSet: 'KE-set',
    mandate: 'rental-protection',
    contactUrl: null,
  },
  {
    countryCode: 'KE',
    nameEn: 'Ministry of Lands and Physical Planning',
    nameLocal: 'Wizara ya Ardhi na Mipango ya Kimwili',
    slug: 'mlpp-ke',
    regulatorSet: 'KE-set',
    mandate: 'land-registry',
    contactUrl: 'https://lands.go.ke/',
  },
  {
    countryCode: 'KE',
    nameEn: 'National Construction Authority',
    nameLocal: 'Mamlaka ya Ujenzi ya Kitaifa',
    slug: 'nca-ke',
    regulatorSet: 'KE-set',
    mandate: 'building-safety',
    contactUrl: 'https://nca.go.ke/',
  },
  {
    countryCode: 'KE',
    nameEn: 'Office of the Data Protection Commissioner',
    nameLocal: 'Ofisi ya Kamishna wa Ulinzi wa Data',
    slug: 'odpc-ke',
    regulatorSet: 'KE-set',
    mandate: 'data-protection',
    contactUrl: 'https://www.odpc.go.ke/',
  },

  // ─── UG — Uganda ───────────────────────────────────────────────────
  {
    countryCode: 'UG',
    nameEn: 'Ministry of Lands, Housing and Urban Development',
    nameLocal: null,
    slug: 'mlhud-ug',
    regulatorSet: 'UG-set',
    mandate: 'land-registry',
    contactUrl: 'https://mlhud.go.ug/',
  },
  {
    countryCode: 'UG',
    nameEn: 'Kampala Capital City Authority',
    nameLocal: null,
    slug: 'kcca-ug',
    regulatorSet: 'UG-set',
    mandate: 'planning-permission',
    contactUrl: 'https://www.kcca.go.ug/',
  },
  {
    countryCode: 'UG',
    nameEn: 'Uganda Revenue Authority — Property Rates',
    nameLocal: null,
    slug: 'ura-property-ug',
    regulatorSet: 'UG-set',
    mandate: 'property-tax',
    contactUrl: 'https://www.ura.go.ug/',
  },

  // ─── NG — Nigeria ──────────────────────────────────────────────────
  {
    countryCode: 'NG',
    nameEn: 'Lagos State Tenancy Law Tribunal',
    nameLocal: null,
    slug: 'lagos-tenancy-ng',
    regulatorSet: 'NG-set',
    mandate: 'tenancy-tribunal',
    contactUrl: 'https://lagosstate.gov.ng/',
  },
  {
    countryCode: 'NG',
    nameEn: 'Federal Inland Revenue Service — Property Tax',
    nameLocal: null,
    slug: 'firs-property-ng',
    regulatorSet: 'NG-set',
    mandate: 'property-tax',
    contactUrl: 'https://www.firs.gov.ng/',
  },
  {
    countryCode: 'NG',
    nameEn: 'Nigeria Data Protection Bureau',
    nameLocal: null,
    slug: 'ndpb-ng',
    regulatorSet: 'NG-set',
    mandate: 'data-protection',
    contactUrl: 'https://ndpb.gov.ng/',
  },

  // ─── ZA — South Africa ─────────────────────────────────────────────
  {
    countryCode: 'ZA',
    nameEn: 'Rental Housing Tribunal',
    nameLocal: 'Huurbehuising-Tribunaal',
    slug: 'rht-za',
    regulatorSet: 'ZA-set',
    mandate: 'tenancy-tribunal',
    contactUrl: 'https://www.gov.za/services/rental-housing-tribunal',
  },
  {
    countryCode: 'ZA',
    nameEn: 'Information Regulator (POPI)',
    nameLocal: 'Inligtingsreguleerder',
    slug: 'info-regulator-za',
    regulatorSet: 'ZA-set',
    mandate: 'data-protection',
    contactUrl: 'https://inforegulator.org.za/',
  },
  {
    countryCode: 'ZA',
    nameEn: 'Community Schemes Ombud Service',
    nameLocal: null,
    slug: 'csos-za',
    regulatorSet: 'ZA-set',
    mandate: 'hoa-strata',
    contactUrl: 'https://csos.org.za/',
  },

  // ─── UK — United Kingdom ───────────────────────────────────────────
  {
    countryCode: 'GB',
    nameEn: 'The Property Ombudsman',
    nameLocal: null,
    slug: 'tpos-uk',
    regulatorSet: 'UK-set',
    mandate: 'tenant-rights',
    contactUrl: 'https://www.tpos.co.uk/',
  },
  {
    countryCode: 'GB',
    nameEn: 'Deposit Protection Service',
    nameLocal: null,
    slug: 'dps-uk',
    regulatorSet: 'UK-set',
    mandate: 'rental-protection',
    contactUrl: 'https://www.depositprotection.com/',
  },
  {
    countryCode: 'GB',
    nameEn: 'HM Land Registry',
    nameLocal: null,
    slug: 'hmlr-uk',
    regulatorSet: 'UK-set',
    mandate: 'land-registry',
    contactUrl: 'https://www.gov.uk/government/organisations/land-registry',
  },
  {
    countryCode: 'GB',
    nameEn: 'Information Commissioner Office (GDPR/DPA)',
    nameLocal: null,
    slug: 'ico-uk',
    regulatorSet: 'UK-set',
    mandate: 'data-protection',
    contactUrl: 'https://ico.org.uk/',
  },

  // ─── US — United States (federal-anchor row) ──────────────────────
  {
    countryCode: 'US',
    nameEn: 'Department of Housing and Urban Development',
    nameLocal: null,
    slug: 'hud-us',
    regulatorSet: 'US-set',
    mandate: 'housing-authority',
    contactUrl: 'https://www.hud.gov/',
  },
  {
    countryCode: 'US',
    nameEn: 'Federal Trade Commission — Tenant Rights',
    nameLocal: null,
    slug: 'ftc-tenant-us',
    regulatorSet: 'US-set',
    mandate: 'tenant-rights',
    contactUrl: 'https://www.ftc.gov/',
  },

  // ─── AU — Australia ───────────────────────────────────────────────
  {
    countryCode: 'AU',
    nameEn: 'NSW Civil and Administrative Tribunal — Tenancy Division',
    nameLocal: null,
    slug: 'nsw-tribunal-au',
    regulatorSet: 'AU-set',
    mandate: 'tenancy-tribunal',
    contactUrl: 'https://www.ncat.nsw.gov.au/',
  },
  {
    countryCode: 'AU',
    nameEn: 'Australian Taxation Office — Rental Income',
    nameLocal: null,
    slug: 'ato-rental-au',
    regulatorSet: 'AU-set',
    mandate: 'property-tax',
    contactUrl: 'https://www.ato.gov.au/',
  },
  {
    countryCode: 'AU',
    nameEn: 'Office of the Australian Information Commissioner',
    nameLocal: null,
    slug: 'oaic-au',
    regulatorSet: 'AU-set',
    mandate: 'data-protection',
    contactUrl: 'https://www.oaic.gov.au/',
  },

  // ─── generic — fallback ───────────────────────────────────────────
  {
    countryCode: 'ZZ',
    nameEn: 'Generic Tenant Rights Advisor',
    nameLocal: null,
    slug: 'generic-tenant-rights',
    regulatorSet: 'generic',
    mandate: 'tenant-rights',
    contactUrl: null,
  },
  {
    countryCode: 'ZZ',
    nameEn: 'Generic Data Protection Reference',
    nameLocal: null,
    slug: 'generic-data-protection',
    regulatorSet: 'generic',
    mandate: 'data-protection',
    contactUrl: null,
  },
];

/**
 * Idempotent seeder — uses (regulatorSet, slug) unique index to skip
 * existing rows. Returns the number of rows inserted vs skipped.
 */
export async function seedRegulatorJurisdictions(
  db: DatabaseClient,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const row of REGULATOR_JURISDICTION_SEED) {
    const existing = await db
      .select({ id: regulatorJurisdictions.id })
      .from(regulatorJurisdictions)
      .where(
        and(
          eq(regulatorJurisdictions.regulatorSet, row.regulatorSet),
          eq(regulatorJurisdictions.slug, row.slug),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    await db.insert(regulatorJurisdictions).values({
      countryCode: row.countryCode,
      nameEn: row.nameEn,
      nameLocal: row.nameLocal ?? undefined,
      slug: row.slug,
      regulatorSet: row.regulatorSet,
      mandate: row.mandate,
      contactUrl: row.contactUrl ?? undefined,
    });
    inserted += 1;
  }

  return { inserted, skipped };
}
