/**
 * JA-3 — Jurisdiction-aware capability resolution.
 *
 * Sibling module to capability-registry.ts. Holds per-jurisdiction
 * overrides for capability entries whose user_outcome /
 * public_description / example_response_pattern reference a
 * specific regulator / currency / tenancy regime that changes
 * per country.
 *
 * Used by:
 *   - services/api-gateway/src/composition/brain-tools/
 *     capability-tools.ts (mwikila.capabilities.what_can_you_do +
 *     mwikila.about) to render the jurisdiction-correct example
 *     for the tenant's current country.
 *
 * Design rules:
 *   1. Overrides are PER FIELD, not per-entry. Most capabilities
 *      don't need an override — only the ones that mention a housing
 *      regulator / TZS / a tenancy authority / etc.
 *   2. When no override is found for a (capability_id, country)
 *      pair, the default entry's value is returned. The TZ default
 *      lives in the canonical entry itself (we are TZS-first).
 *   3. The override map is FROZEN at module load — no runtime
 *      mutation.
 *   4. Country code keys are ISO-3166-1 alpha-2.
 *
 * Adding a new jurisdiction = one row in the overrides table per
 * affected capability id.
 */

import type { BilingualString } from './types.js';

/**
 * Override bundle for a single (capability, jurisdiction) pair.
 * Every field is optional — only the per-jurisdiction fields that
 * actually change need to be supplied.
 */
export interface CapabilityJurisdictionOverride {
  readonly user_outcome?: string;
  readonly public_description?: BilingualString;
  readonly example_response_pattern?: BilingualString;
}

/**
 * Frozen registry: `{ capabilityId → { ISO-alpha-2 → override } }`.
 * Only capabilities that REFERENCE a regulator / currency / licence
 * type appear here. Everything else stays jurisdiction-agnostic.
 */
export const CAPABILITY_JURISDICTION_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, CapabilityJurisdictionOverride>>>
> = Object.freeze({
  // ─────────────────────────────────────────────────────────────
  // Lease tracking — the tenancy regime / registry differs per
  // country. TZ default lives in the canonical registry entry.
  // ─────────────────────────────────────────────────────────────
  'mwikila.track.leases': Object.freeze({
    KE: Object.freeze({
      user_outcome: 'Owner sees every tenancy agreement and its days-to-expiry at a glance.',
      public_description: Object.freeze({
        en: 'Fixed-term and periodic tenancies — Mr. Mwikila tracks every active lease under the Kenyan Landlord and Tenant Act, the days remaining, and pre-fills the renewal and rent-review notices.',
        sw: 'Mikataba ya muda maalum na ya kawaida — Mwikila hufuatilia kila mkataba chini ya sheria ya wapangaji ya Kenya, siku zilizobaki, na kujaza notisi za upyaji na mapitio ya kodi.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'Fixed-term tenancies and ground leases — Mr. Mwikila tracks every active lease under Ugandan landlord-tenant law, the days remaining, and pre-fills the renewal notice.',
        sw: 'Mikataba ya muda maalum na ya ardhi — Mwikila hufuatilia kila mkataba chini ya sheria ya wapangaji ya Uganda, siku zilizobaki, na kujaza notisi ya upyaji.',
      }),
    }),
    NG: Object.freeze({
      user_outcome: 'Owner sees every registered tenancy and its days-to-expiry at a glance.',
      public_description: Object.freeze({
        en: 'Tenancy agreements and Certificates of Occupancy — Mr. Mwikila tracks every active tenancy under the relevant state Tenancy Law (e.g. Lagos), the days remaining, and drafts the renewal and statutory notices.',
        sw: 'Mikataba ya upangaji na Hati za Umiliki — Mwikila hufuatilia kila mkataba chini ya sheria ya upangaji ya jimbo (mfano Lagos), siku zilizobaki, na huandaa notisi za upyaji.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'Residential and commercial leases — Mr. Mwikila tracks every active lease under the South African Rental Housing Act, the days remaining, and pre-fills the renewal application.',
        sw: 'Mikataba ya makazi na biashara — Mwikila hufuatilia kila mkataba chini ya sheria ya makazi ya kupanga ya Afrika Kusini, siku zilizobaki, na kujaza maombi ya upyaji.',
      }),
    }),
    AU: Object.freeze({
      public_description: Object.freeze({
        en: 'Residential and retail leases — Mr. Mwikila tracks every active lease under the relevant state tenancy authority (e.g. NSW Fair Trading / Consumer Affairs Victoria), the days remaining, and pre-fills the renewal application.',
        sw: 'Mikataba ya makazi na biashara — Mwikila hufuatilia kila mkataba chini ya mamlaka husika ya jimbo, siku zilizobaki, na kujaza maombi ya upyaji.',
      }),
    }),
    CL: Object.freeze({
      public_description: Object.freeze({
        en: 'Contratos de Arrendamiento — Mr. Mwikila tracks every active lease registered under Chilean tenancy law, the days remaining, and pre-fills the renewal and annual adjustment.',
        sw: 'Contratos de Arrendamiento — Mwikila hufuatilia kila mkataba chini ya sheria ya upangaji ya Chile, siku zilizobaki, na kujaza upyaji na marekebisho ya mwaka.',
      }),
    }),
    ID: Object.freeze({
      public_description: Object.freeze({
        en: 'Sewa / Kontrak tenancies — Mr. Mwikila tracks every active lease under Indonesian tenancy regulation, the days remaining, and pre-fills the renewal form.',
        sw: 'Mikataba ya Sewa / Kontrak — Mwikila hufuatilia kila mkataba chini ya kanuni za upangaji za Indonesia, siku zilizobaki, na kujaza fomu ya upyaji.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Lease renewal alerts — same ladder days, different regulator.
  // ─────────────────────────────────────────────────────────────
  'mwikila.alert.lease': Object.freeze({
    KE: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 60, 47, 30, and 7 days before any Kenyan tenancy expires, with the statutory renewal and rent-review notice already pre-filled.',
        sw: 'Mwikila hukutahadharisha siku 90, 60, 47, 30, na 7 kabla ya mkataba wa Kenya kuisha, notisi ya upyaji imeshajazwa.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 60, 47, 30, and 7 days before any Ugandan tenancy expires, with the renewal notice already pre-filled.',
        sw: 'Mwikila hukutahadharisha siku 90, 60, 47, 30, na 7 kabla ya mkataba wa Uganda kuisha, notisi ya upyaji imeshajazwa.',
      }),
    }),
    NG: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 365, 180, 90, 47, and 30 days before any Nigerian tenancy expires (tenancies often renew annually), with the statutory renewal notice already drafted.',
        sw: 'Mwikila hukutahadharisha siku 365, 180, 90, 47, na 30 kabla ya mkataba wa Nigeria kuisha (mara nyingi hupyaiwa kila mwaka), notisi ya upyaji ushaaandaliwa.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 365, 90, 47, 30, and 7 days before any South African lease expires, with the renewal application already drafted.',
        sw: 'Mwikila hukutahadharisha siku 365, 90, 47, 30, na 7 kabla ya mkataba wa Afrika Kusini kuisha.',
      }),
    }),
    AU: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 365, 90, 47, 30, and 7 days before any Australian lease expires, with the renewal application already drafted.',
        sw: 'Mwikila hukutahadharisha kabla ya mkataba wa Australia kuisha.',
      }),
    }),
    CL: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 47, 30, and 7 days before any Chilean lease renewal or annual adjustment is due, with the paperwork already queued.',
        sw: 'Mwikila hukutahadharisha kabla ya upyaji au marekebisho ya mwaka ya mkataba wa Chile kufika.',
      }),
    }),
    ID: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 180, 90, 47, 30, and 7 days before any Indonesian lease expires, with the renewal form already pre-filled.',
        sw: 'Mwikila hukutahadharisha kabla ya mkataba wa Indonesia kuisha.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Anti-graft / ownership-disclosure capability — the regulator
  // name is TZ-specific; other jurisdictions have their own.
  // ─────────────────────────────────────────────────────────────
  'mwikila.compliance.anti-graft': Object.freeze({
    KE: Object.freeze({
      user_outcome: 'Owner files anti-corruption disclosures to EACC on time.',
      public_description: Object.freeze({
        en: 'Mr. Mwikila drafts and tracks Ethics and Anti-Corruption Commission (EACC) self-declaration filings — beneficial owner schedules, related-party disclosures, gift register — and queues them on the EACC cadence.',
        sw: 'Mwikila huandaa na kufuatilia mafaili ya EACC — taarifa za wamiliki halisi, mahusiano, daftari la zawadi — na kuyapanga kwa ratiba ya EACC.',
      }),
    }),
    NG: Object.freeze({
      user_outcome: 'Owner files anti-corruption disclosures to EFCC + ICPC on time.',
      public_description: Object.freeze({
        en: 'Mr. Mwikila drafts and tracks Economic and Financial Crimes Commission (EFCC) and Independent Corrupt Practices Commission (ICPC) disclosures, queued on each agency cadence.',
        sw: 'Mwikila huandaa na kufuatilia mafaili ya EFCC na ICPC, yamepangwa kwa ratiba.',
      }),
    }),
    ZA: Object.freeze({
      user_outcome: 'Owner files anti-corruption disclosures to SIU / Hawks on time.',
      public_description: Object.freeze({
        en: 'Mr. Mwikila drafts and tracks Special Investigating Unit (SIU) and Directorate for Priority Crime Investigation (Hawks) disclosures.',
        sw: 'Mwikila huandaa na kufuatilia mafaili ya SIU na Hawks.',
      }),
    }),
  }),
});

/**
 * Resolve the jurisdiction-specific copy for a capability field.
 *
 * @param capabilityId the canonical id (e.g. `mwikila.track.leases`)
 * @param country ISO-3166-1 alpha-2 (e.g. `KE`); TZ returns the default
 * @returns the override bundle or null when no override exists
 */
export function getCapabilityOverride(
  capabilityId: string,
  country: string,
): CapabilityJurisdictionOverride | null {
  const upper = country.toUpperCase();
  const perCapability = CAPABILITY_JURISDICTION_OVERRIDES[capabilityId];
  if (!perCapability) return null;
  return perCapability[upper] ?? null;
}

/**
 * Returns true when the capability has at least one jurisdiction
 * override registered. Surfaces to tests + audit walkers.
 */
export function hasJurisdictionOverrides(capabilityId: string): boolean {
  return capabilityId in CAPABILITY_JURISDICTION_OVERRIDES;
}

/**
 * Returns all capability ids that have at least one jurisdiction
 * override registered. Test fixtures pin this list to detect
 * regression.
 */
export function listCapabilitiesWithOverrides(): ReadonlyArray<string> {
  return Object.freeze(Object.keys(CAPABILITY_JURISDICTION_OVERRIDES));
}
