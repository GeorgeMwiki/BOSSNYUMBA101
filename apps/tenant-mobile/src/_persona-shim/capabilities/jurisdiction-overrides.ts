/**
 * JA-3 — Jurisdiction-aware capability resolution.
 *
 * Sibling module to capability-registry.ts. Holds per-jurisdiction
 * overrides for capability entries whose user_outcome /
 * public_description / example_response_pattern reference a
 * specific regulator / currency / lease regime that changes
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
 *      regulator / currency / tenancy regime / etc.
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
 * Only capabilities that REFERENCE a regulator / currency / tenancy
 * regime appear here. Everything else stays jurisdiction-agnostic.
 */
export const CAPABILITY_JURISDICTION_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, CapabilityJurisdictionOverride>>>
> = Object.freeze({
  // ─────────────────────────────────────────────────────────────
  // Lease tracking — Tanzania's tenancy law is the TZ default;
  // other jurisdictions use their own tenancy / rent regimes.
  // ─────────────────────────────────────────────────────────────
  'mwikila.track.leases': Object.freeze({
    KE: Object.freeze({
      user_outcome: 'Owner sees every tenancy agreement and its days-to-renewal at a glance.',
      public_description: Object.freeze({
        en: 'Fixed-term tenancy, periodic tenancy, controlled tenancy — Mr. Mwikila tracks every active lease under the Kenyan Landlord and Tenant Act and the Rent Restriction Tribunal rules, the days remaining, and pre-fills the renewal and notice forms.',
        sw: 'Mkataba wa muda maalum, mkataba wa kipindi, mkataba unaodhibitiwa — Mwikila hufuatilia kila mkataba wa pango chini ya sheria ya wamiliki na wapangaji ya Kenya, siku zilizobaki, na kujaza fomu za upyaji na notisi.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'Fixed-term tenancy, periodic tenancy — Mr. Mwikila tracks every active lease under the Ugandan Landlord and Tenant Act, the days remaining, and pre-fills the renewal form.',
        sw: 'Mkataba wa muda maalum, mkataba wa kipindi — Mwikila hufuatilia kila mkataba wa pango chini ya sheria ya wamiliki na wapangaji ya Uganda, siku zilizobaki, na kujaza fomu ya upyaji.',
      }),
    }),
    NG: Object.freeze({
      user_outcome: 'Owner sees every tenancy and its days-to-renewal at a glance.',
      public_description: Object.freeze({
        en: 'Yearly tenancy, monthly tenancy, statutory tenancy — Mr. Mwikila tracks every active lease under the relevant State Tenancy Law (e.g. Lagos), the days remaining, and drafts the statutory quit notice when needed.',
        sw: 'Mkataba wa mwaka, mkataba wa mwezi, mkataba wa kisheria — Mwikila hufuatilia kila mkataba wa pango chini ya sheria ya pango ya jimbo husika, siku zilizobaki, na huandaa notisi ya kisheria inapohitajika.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'Fixed-term lease, periodic lease — Mr. Mwikila tracks every active lease under the South African Rental Housing Act and Consumer Protection Act, the days remaining, and pre-fills the renewal and Rental Housing Tribunal forms.',
        sw: 'Mkataba wa muda maalum, mkataba wa kipindi — Mwikila hufuatilia kila mkataba wa pango chini ya sheria ya nyumba za kupanga ya Afrika Kusini, siku zilizobaki, na kujaza fomu za upyaji.',
      }),
    }),
    AU: Object.freeze({
      public_description: Object.freeze({
        en: 'Fixed-term agreement, periodic agreement — Mr. Mwikila tracks every active residential tenancy under the relevant state authority (NSW Fair Trading / Consumer Affairs Victoria / QLD RTA), the days remaining, and pre-fills the renewal and bond forms.',
        sw: 'Mkataba wa muda maalum, mkataba wa kipindi — Mwikila hufuatilia kila mkataba wa pango chini ya mamlaka husika ya jimbo, siku zilizobaki, na kujaza fomu za upyaji na dhamana.',
      }),
    }),
    GB: Object.freeze({
      public_description: Object.freeze({
        en: 'Assured shorthold tenancy (AST), periodic tenancy — Mr. Mwikila tracks every active tenancy under the Housing Act, the days remaining, and pre-fills the renewal and deposit-protection paperwork.',
        sw: 'Mkataba wa AST, mkataba wa kipindi — Mwikila hufuatilia kila mkataba wa pango chini ya sheria ya nyumba, siku zilizobaki, na kujaza karatasi za upyaji na ulinzi wa dhamana.',
      }),
    }),
    US: Object.freeze({
      public_description: Object.freeze({
        en: 'Fixed-term lease, month-to-month tenancy — Mr. Mwikila tracks every active lease under the relevant state landlord-tenant statute, the days remaining, and pre-fills the renewal and notice forms.',
        sw: 'Mkataba wa muda maalum, mkataba wa mwezi-kwa-mwezi — Mwikila hufuatilia kila mkataba wa pango chini ya sheria husika ya jimbo, siku zilizobaki, na kujaza fomu za upyaji na notisi.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Lease renewal alerts — same ladder days, different regulator.
  // ─────────────────────────────────────────────────────────────
  'mwikila.alert.lease': Object.freeze({
    KE: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 60, 47, 30, and 7 days before any Kenyan tenancy expires, with the renewal and statutory notice already pre-filled.',
        sw: 'Mwikila hukutahadharisha siku 90, 60, 47, 30, na 7 kabla ya mkataba wa pango wa Kenya kuisha, fomu ya upyaji na notisi imeshajazwa.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 60, 47, 30, and 7 days before any Ugandan tenancy expires, with the renewal form already pre-filled.',
        sw: 'Mwikila hukutahadharisha siku 90, 60, 47, 30, na 7 kabla ya mkataba wa pango wa Uganda kuisha, fomu ya upyaji imeshajazwa.',
      }),
    }),
    NG: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 180, 90, 47, 30, and 7 days before any Nigerian tenancy expires, with the statutory quit notice already drafted to the State Tenancy Law standard.',
        sw: 'Mwikila hukutahadharisha siku 180, 90, 47, 30, na 7 kabla ya mkataba wa pango wa Nigeria kuisha, notisi ya kisheria ushaaandaliwa.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 47, 30, and 7 days before any South African lease expires, with the renewal application already drafted.',
        sw: 'Mwikila hukutahadharisha siku 90, 47, 30, na 7 kabla ya mkataba wa pango wa Afrika Kusini kuisha.',
      }),
    }),
    AU: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 47, 30, and 7 days before any Australian tenancy expires, with the state-authority renewal application already drafted.',
        sw: 'Mwikila hukutahadharisha kabla ya mkataba wa pango wa Australia kuisha.',
      }),
    }),
    GB: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 60, 47, 30, and 7 days before any UK tenancy expires, with the renewal and Section 21 / Section 8 paperwork already prepared.',
        sw: 'Mwikila hukutahadharisha kabla ya mkataba wa pango wa Uingereza kuisha.',
      }),
    }),
    US: Object.freeze({
      public_description: Object.freeze({
        en: 'Mr. Mwikila warns you 90, 60, 47, 30, and 7 days before any US lease expires, with the renewal and notice paperwork already prepared.',
        sw: 'Mwikila hukutahadharisha kabla ya mkataba wa pango wa Marekani kuisha.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Statutory / anti-corruption housing compliance — the bureau
  // name is TZ-specific; other jurisdictions have their own bodies.
  // ─────────────────────────────────────────────────────────────
  'mwikila.compliance.statutory': Object.freeze({
    KE: Object.freeze({
      user_outcome: 'Owner files statutory housing and anti-corruption disclosures to EACC on time.',
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
