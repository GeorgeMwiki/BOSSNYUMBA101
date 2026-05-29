/**
 * JA-3 — Jurisdiction-aware capability resolution (real-estate edition).
 *
 * Sibling module to capability-registry.ts. Holds per-jurisdiction
 * overrides for capability entries whose user_outcome /
 * public_description / example_response_pattern reference a
 * specific regulator / currency / lease format that changes
 * per country.
 *
 * Used by:
 *   - services/api-gateway/src/composition/brain-tools/
 *     capability-tools.ts (bossnyumba.capabilities.what_can_you_do +
 *     bossnyumba.about) to render the jurisdiction-correct example
 *     for the tenant's current country.
 *
 * Design rules:
 *   1. Overrides are PER FIELD, not per-entry. Most capabilities
 *      don't need an override — only the ones that mention KRA / RERA /
 *      Landlord and Tenant Act / TZS / KES / specific authorities.
 *   2. When no override is found for a (capability_id, country)
 *      pair, the default entry's value is returned. The KE default
 *      lives in the canonical entry itself (we are KE-first in the
 *      registry copy — KE is the largest BOSSNYUMBA market).
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
 * Only capabilities that REFERENCE a regulator / currency / lease
 * format appear here. Everything else stays jurisdiction-agnostic.
 */
export const CAPABILITY_JURISDICTION_OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, CapabilityJurisdictionOverride>>>
> = Object.freeze({
  // ─────────────────────────────────────────────────────────────
  // Compliance — KRA / RERA are KE; TZ / UG / NG / ZA / AU all
  // have their own housing / revenue authorities.
  // ─────────────────────────────────────────────────────────────
  'mwikila.compliance.statutory': Object.freeze({
    TZ: Object.freeze({
      public_description: Object.freeze({
        en: 'TRA rental income, fire safety certification (Tanzania Fire and Rescue Force), lift inspection (OSHA-TZ), body-corporate AGM minutes, insurance renewals — Mr. Mwikila keeps the calendar, pre-fills the standard forms, and reminds the owner before every deadline.',
        sw: 'TRA mapato ya kodi, hati ya usalama wa moto (Tanzania Fire and Rescue Force), ukaguzi wa lifti (OSHA-TZ), muhtasari wa AGM, kuhuisha bima — Mwikila huweka ratiba, kujaza fomu sanifu, na kumkumbusha mmiliki kabla ya kila tarehe.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'URA rental income, Building Control Authority safety certificate, lift inspection, body-corporate AGM minutes, insurance renewals — Mr. Mwikila keeps the calendar, pre-fills the standard forms, and reminds the owner before every deadline.',
        sw: 'URA mapato ya kodi, hati ya usalama wa Building Control Authority, ukaguzi wa lifti, muhtasari wa AGM, kuhuisha bima — Mwikila huweka ratiba.',
      }),
    }),
    NG: Object.freeze({
      public_description: Object.freeze({
        en: 'FIRS rental income (or LIRS for Lagos), Federal Fire Service certificate, lift inspection, Sectional Title AGM minutes, insurance renewals — Mr. Mwikila keeps the calendar, pre-fills the standard forms, and reminds the owner before every deadline.',
        sw: 'FIRS / LIRS mapato ya kodi, hati ya Federal Fire Service, ukaguzi wa lifti, muhtasari wa Sectional Title AGM, kuhuisha bima — Mwikila huweka ratiba.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'SARS rental income, COCT / municipal fire compliance certificate, lift inspection under OHS Act, Sectional Title AGM minutes (STSMA), insurance renewals — Mr. Mwikila keeps the calendar, pre-fills the standard forms, and reminds the owner before every deadline.',
        sw: 'SARS mapato ya kodi, hati ya moto (COCT / kanda), ukaguzi wa lifti chini ya OHS Act, muhtasari wa AGM (STSMA), kuhuisha bima — Mwikila huweka ratiba.',
      }),
    }),
    AU: Object.freeze({
      public_description: Object.freeze({
        en: 'ATO rental income, state fire and electrical compliance certificates, lift registration, Owners Corporation AGM minutes, insurance renewals — Mr. Mwikila keeps the calendar, pre-fills the standard forms, and reminds the owner before every deadline.',
        sw: 'ATO mapato ya kodi, hati za usalama wa moto na umeme, leseni ya lifti, muhtasari wa Owners Corporation AGM, kuhuisha bima — Mwikila huweka ratiba.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Communicate with the regulator — name of the right authority
  // per jurisdiction.
  // ─────────────────────────────────────────────────────────────
  'mwikila.communicate.regulator': Object.freeze({
    TZ: Object.freeze({
      public_description: Object.freeze({
        en: 'Letters and filings to TRA / NHC / local LGAs — Mr. Mwikila uses the authority-required format and tone. Where the form is standard, he pre-fills it for one-click submission.',
        sw: 'Barua na fomu kwa TRA / NHC / serikali za mitaa — Mwikila hutumia muundo na lugha inayotakwa.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'Letters and filings to URA / KCCA / Ministry of Lands — Mr. Mwikila uses the authority-required format and tone. Where the form is standard, he pre-fills it for one-click submission.',
        sw: 'Barua na fomu kwa URA / KCCA / Wizara ya Ardhi — Mwikila hutumia muundo na lugha inayotakwa.',
      }),
    }),
    NG: Object.freeze({
      public_description: Object.freeze({
        en: 'Letters and filings to FIRS / LIRS / state housing authorities — Mr. Mwikila uses the authority-required format and tone. Where the form is standard, he pre-fills it for one-click submission.',
        sw: 'Barua na fomu kwa FIRS / LIRS / mamlaka za nyumba za jimbo — Mwikila hutumia muundo na lugha inayotakwa.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'Letters and filings to SARS / Rental Housing Tribunal / municipal property departments — Mr. Mwikila uses the authority-required format and tone. Where the form is standard, he pre-fills it for one-click submission.',
        sw: 'Barua na fomu kwa SARS / Rental Housing Tribunal — Mwikila hutumia muundo unaohitajika.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Multi-currency primary — country sets the default ISO-4217.
  // ─────────────────────────────────────────────────────────────
  'mwikila.multi-currency.tzs-primary': Object.freeze({
    TZ: Object.freeze({
      public_description: Object.freeze({
        en: 'Local currency is primary (TZS) — every figure carries the ISO-4217 code on first mention. USD-quoted leases are supported and converted with the BoT reference rate.',
        sw: 'Sarafu ya ndani ni ya msingi (TZS) — kila tarakimu ina msimbo wa ISO-4217. Mikataba ya USD inakubaliwa.',
      }),
    }),
    UG: Object.freeze({
      public_description: Object.freeze({
        en: 'Local currency is primary (UGX) — every figure carries the ISO-4217 code on first mention. USD-quoted leases are supported and converted with the BoU reference rate.',
        sw: 'Sarafu ya ndani ni ya msingi (UGX) — kila tarakimu ina msimbo wa ISO-4217.',
      }),
    }),
    NG: Object.freeze({
      public_description: Object.freeze({
        en: 'Local currency is primary (NGN) — every figure carries the ISO-4217 code on first mention. USD-quoted leases are supported and converted with the CBN reference rate.',
        sw: 'Sarafu ya ndani ni ya msingi (NGN) — kila tarakimu ina msimbo wa ISO-4217.',
      }),
    }),
    ZA: Object.freeze({
      public_description: Object.freeze({
        en: 'Local currency is primary (ZAR) — every figure carries the ISO-4217 code on first mention. USD-quoted leases are supported and converted with the SARB reference rate.',
        sw: 'Sarafu ya ndani ni ya msingi (ZAR) — kila tarakimu ina msimbo wa ISO-4217.',
      }),
    }),
    AU: Object.freeze({
      public_description: Object.freeze({
        en: 'Local currency is primary (AUD) — every figure carries the ISO-4217 code on first mention. USD-quoted leases are supported and converted with the RBA reference rate.',
        sw: 'Sarafu ya ndani ni ya msingi (AUD) — kila tarakimu ina msimbo wa ISO-4217.',
      }),
    }),
  }),

  // ─────────────────────────────────────────────────────────────
  // Meta jurisdiction — show the current country's authorities.
  // ─────────────────────────────────────────────────────────────
  'mwikila.meta.jurisdiction': Object.freeze({
    TZ: Object.freeze({
      example_response_pattern: Object.freeze({
        en: 'You are set to Tanzania (TZ). Currency TZS, housing authority NHC and the LGA estate department, revenue authority TRA. Want to switch to KE for this turn only?',
        sw: 'Umewekwa Tanzania (TZ). Sarafu TZS, mamlaka NHC na idara ya nyumba ya LGA, TRA kwa mapato. Ubadilishe kwa KE kwa zamu hii tu?',
      }),
    }),
    UG: Object.freeze({
      example_response_pattern: Object.freeze({
        en: 'You are set to Uganda (UG). Currency UGX, Ministry of Lands and Housing for tenure, URA for rental income.',
        sw: 'Umewekwa Uganda (UG). Sarafu UGX, Wizara ya Ardhi kwa miliki, URA kwa mapato.',
      }),
    }),
    NG: Object.freeze({
      example_response_pattern: Object.freeze({
        en: 'You are set to Nigeria (NG). Currency NGN, state housing authority (Lagos / Abuja / etc.), FIRS / LIRS for rental income.',
        sw: 'Umewekwa Nigeria (NG). Sarafu NGN, mamlaka ya nyumba ya jimbo, FIRS / LIRS kwa mapato.',
      }),
    }),
    ZA: Object.freeze({
      example_response_pattern: Object.freeze({
        en: 'You are set to South Africa (ZA). Currency ZAR, Rental Housing Tribunal and municipal property authorities, SARS for rental income.',
        sw: 'Umewekwa South Africa (ZA). Sarafu ZAR, Rental Housing Tribunal, SARS.',
      }),
    }),
    AU: Object.freeze({
      example_response_pattern: Object.freeze({
        en: 'You are set to Australia (AU). Currency AUD, state residential tenancy authorities (CAV / NSW Fair Trading / RTA QLD), ATO for rental income.',
        sw: 'Umewekwa Australia (AU). Sarafu AUD, mamlaka za makazi za jimbo, ATO kwa mapato.',
      }),
    }),
  }),
});

export function getCapabilityOverride(
  capabilityId: string,
  country: string,
): CapabilityJurisdictionOverride | undefined {
  return CAPABILITY_JURISDICTION_OVERRIDES[capabilityId]?.[country];
}

export function hasJurisdictionOverrides(capabilityId: string): boolean {
  const bucket = CAPABILITY_JURISDICTION_OVERRIDES[capabilityId];
  if (!bucket) return false;
  return Object.keys(bucket).length > 0;
}

export function listCapabilitiesWithOverrides(): ReadonlyArray<string> {
  return Object.freeze(Object.keys(CAPABILITY_JURISDICTION_OVERRIDES));
}
