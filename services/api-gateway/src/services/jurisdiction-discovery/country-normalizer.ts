/**
 * Country normalizer — JC-1 helper (real-estate edition).
 *
 * Maps user-typed strings to ISO-3166-1 alpha-2 codes + canonical
 * names. Supports both the alpha-2 code form ("GH", "RW") and common
 * English names ("Ghana", "Rwanda", "DRC", "Congo (Kinshasa)"). The
 * map is intentionally small — fills the long tail by passing the
 * input through as a "best-guess" code so discovery can still fire.
 *
 * The full ISO-3166 catalogue is owned by the BossNyumba regulator
 * seed; this helper focuses on the discovery hot-path: the country
 * names users actually type when asking Mr. Mwikila about a rental
 * property abroad or a tenancy regulation in another market.
 *
 * Ported from Borjie — the seeded short-circuit list mirrors
 * BossNyumba's `jurisdiction-resolver/index.ts` SNAPSHOTS (KE / TZ /
 * UG / NG / ZA / AU / UK / US). The discovery hot-path 8-probe list
 * is retailored to common real-estate growth markets (Ghana, Rwanda,
 * Botswana, Morocco, Egypt, Ethiopia, Senegal, India).
 */

interface CountryEntry {
  readonly code: string;
  readonly name: string;
  readonly aliases: ReadonlyArray<string>;
}

const COUNTRY_REGISTRY: ReadonlyArray<CountryEntry> = Object.freeze([
  // ─── Already-seeded jurisdictions (resolver short-circuit) ─────────
  Object.freeze({ code: 'KE', name: 'Kenya', aliases: ['kenya', 'ke'] }),
  Object.freeze({ code: 'TZ', name: 'Tanzania', aliases: ['tanzania', 'tz'] }),
  Object.freeze({ code: 'UG', name: 'Uganda', aliases: ['uganda', 'ug'] }),
  Object.freeze({ code: 'NG', name: 'Nigeria', aliases: ['nigeria', 'ng'] }),
  Object.freeze({ code: 'ZA', name: 'South Africa', aliases: ['south africa', 'za', 'rsa'] }),
  Object.freeze({ code: 'AU', name: 'Australia', aliases: ['australia', 'au'] }),
  Object.freeze({ code: 'UK', name: 'United Kingdom', aliases: ['united kingdom', 'uk', 'gb', 'britain', 'great britain'] }),
  Object.freeze({ code: 'US', name: 'United States', aliases: ['united states', 'us', 'usa', 'america'] }),
  // ─── Discovery hot-path — 8 growth-market probes (JC-9 real-estate) ─
  Object.freeze({ code: 'GH', name: 'Ghana', aliases: ['ghana', 'gh'] }),
  Object.freeze({ code: 'RW', name: 'Rwanda', aliases: ['rwanda', 'rw'] }),
  Object.freeze({ code: 'BW', name: 'Botswana', aliases: ['botswana', 'bw'] }),
  Object.freeze({ code: 'MA', name: 'Morocco', aliases: ['morocco', 'ma'] }),
  Object.freeze({ code: 'EG', name: 'Egypt', aliases: ['egypt', 'eg'] }),
  Object.freeze({ code: 'ET', name: 'Ethiopia', aliases: ['ethiopia', 'et'] }),
  Object.freeze({ code: 'SN', name: 'Senegal', aliases: ['senegal', 'sn'] }),
  Object.freeze({ code: 'IN', name: 'India', aliases: ['india', 'in'] }),
  // ─── Common adjacent jurisdictions (extend safely as needed) ───────
  Object.freeze({
    code: 'CD',
    name: 'Democratic Republic of the Congo',
    aliases: [
      'drc',
      'dr congo',
      'democratic republic of congo',
      'democratic republic of the congo',
      'congo-kinshasa',
      'congo kinshasa',
      'cd',
    ],
  }),
  Object.freeze({ code: 'BI', name: 'Burundi', aliases: ['burundi', 'bi'] }),
  Object.freeze({
    code: 'MZ',
    name: 'Mozambique',
    aliases: ['mozambique', 'mz'],
  }),
  Object.freeze({ code: 'NA', name: 'Namibia', aliases: ['namibia', 'na'] }),
  Object.freeze({ code: 'ZW', name: 'Zimbabwe', aliases: ['zimbabwe', 'zw'] }),
  Object.freeze({ code: 'ZM', name: 'Zambia', aliases: ['zambia', 'zm'] }),
  Object.freeze({ code: 'CI', name: "Côte d'Ivoire", aliases: ['cote divoire', "cote d'ivoire", 'ivory coast', 'ci'] }),
  Object.freeze({ code: 'CM', name: 'Cameroon', aliases: ['cameroon', 'cm'] }),
]);

/**
 * Normalize a user-typed string to a `{code, name}` pair.
 *
 * Returns the alpha-2 + canonical English name when the input matches
 * a known alias. Falls back to the raw input upper-cased as the code
 * and the original string as the name when no match — the discovery
 * pipeline still fires with the best-guess so Mr. Mwikila never says
 * "I don't know".
 */
export function normalizeCountryInput(
  raw: string,
): { readonly code: string; readonly name: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return Object.freeze({ code: 'UNKNOWN', name: 'Unknown' });
  }
  const lc = trimmed.toLowerCase();
  // Alpha-2 fast path.
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    const byCode = COUNTRY_REGISTRY.find((e) => e.code === upper);
    if (byCode) {
      return Object.freeze({ code: byCode.code, name: byCode.name });
    }
    return Object.freeze({ code: upper, name: upper });
  }
  // Alias match.
  const byAlias = COUNTRY_REGISTRY.find((e) =>
    e.aliases.includes(lc),
  );
  if (byAlias) {
    return Object.freeze({ code: byAlias.code, name: byAlias.name });
  }
  // Best-guess: use the title-cased input as the name + a 2-letter
  // shortcode from the first letters of the words. This keeps the
  // discovery pipeline firing without a registry hit.
  const titleCased = trimmed
    .split(/\s+/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  const fallbackCode =
    titleCased
      .split(/\s+/u)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'XX';
  return Object.freeze({ code: fallbackCode, name: titleCased });
}

/** Test-only: enumerate the registry. */
export function listKnownCountries(): ReadonlyArray<{
  readonly code: string;
  readonly name: string;
}> {
  return Object.freeze(
    COUNTRY_REGISTRY.map((e) =>
      Object.freeze({ code: e.code, name: e.name }),
    ),
  );
}
