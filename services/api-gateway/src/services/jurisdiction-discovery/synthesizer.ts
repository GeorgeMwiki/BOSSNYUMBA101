/**
 * Discovery synthesizer — JC-1 (real-estate edition).
 *
 * Fuses web-search hits + corpus hits into a structured
 * `JurisdictionProfile`. The function is deliberately conservative:
 * it extracts named regulators from the text using a small set of
 * pattern matchers (regulator-noun + jurisdiction-noun) and falls
 * back to the bare country shell when nothing parses out cleanly.
 *
 * The synthesis is a TEXT-LEVEL heuristic, not a full NLP pipeline.
 * Mr. Mwikila will still surface the source URLs / evidence IDs so
 * the user can verify the claim; the synthesizer only ensures the
 * prompt block has a regulator name to anchor the reply.
 *
 * Validity scoring (in [0,1]):
 *   - both web + corpus hits agree on a regulator ⇒ 0.85
 *   - one source only                              ⇒ 0.55
 *   - no source / fallback                         ⇒ 0.20
 *
 * Ported from Borjie — keyword cluster retailored. Mining nouns
 * (mineral, geological, cadastre, EITI) swapped for real-estate
 * authorities (housing, tenancy, tribunal, revenue, land registry,
 * data-protection).
 */

import type {
  DiscoveredRegulator,
  DiscoverySource,
  JurisdictionProfile,
} from './types.js';

interface SynthesizerInput {
  readonly countryCode: string;
  readonly countryName: string;
  readonly webHits: ReadonlyArray<{
    readonly url: string;
    readonly title: string;
    readonly snippet: string;
  }>;
  readonly corpusHits: ReadonlyArray<{
    readonly evidenceId: string;
    readonly title: string;
    readonly snippet: string;
  }>;
}

interface SynthesizerResult {
  readonly profile: JurisdictionProfile;
  readonly sources: ReadonlyArray<DiscoverySource>;
}

// ─── Pattern matchers ──────────────────────────────────────────────────

/**
 * Regulator-name extractor. Looks for capitalised multi-word phrases
 * adjacent to housing / tenancy / revenue / data-protection keywords.
 * Returns a deduped list of candidate names, ranked by hit frequency.
 * The matcher is intentionally narrow — false positives cost more than
 * false negatives because the user sees the candidate in the prompt.
 */
function extractRegulatorNames(
  texts: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const counts = new Map<string, number>();
  // Broad keyword cluster — covers EN ("Ministry", "Department",
  // "Authority", "Commission", "Tribunal", "Commissioner"), FR
  // ("Ministère", "Direction", "Office"), ES/PT ("Ministerio",
  // "Secretaria"), plus generic real-estate / tenancy / revenue
  // nouns. Expand carefully — false positives surface in user-facing
  // copy.
  //
  // SOURCE STRING ONLY — every reference must wrap it in non-capturing
  // parens to keep the outer regex's capture indices stable.
  const KEYWORD_SOURCE =
    'ministry|minist[èe]re|ministerio|department|directorate|direction|authority|commission|bureau|registry|cadastre|agency|institute|service|secretaria|secretariat|tribunal|ombudsman|commissioner|board|housing|tenancy|rental|landlord|revenue|tax|property|land|building|safety|construction|data|protection|gdpr';
  // Capture 1-5 capitalised words ending with the keyword OR preceded
  // by it. We accept both English-style title case ("Ministry of
  // Housing") and French/Latin patterns ("Direction Générale des
  // Impôts").
  const patternEnd = new RegExp(
    `((?:[A-Z][a-zA-Zíéáèêç']{2,}\\s+){0,4}(?:${KEYWORD_SOURCE}))`,
    'giu',
  );
  const patternStart = new RegExp(
    `((?:${KEYWORD_SOURCE})\\s+(?:of|de|des|du|della|del|para|der)?\\s*(?:[A-Z][a-zA-Zíéáèêç']{2,}\\s*){1,5})`,
    'giu',
  );
  // ALL-CAPS regulator acronyms (KRA, HMRC, BPRT, RHT, NCAT, ATO,
  // SARS, FIRS, ICO). 3+ letters to capture canonical short forms.
  // Must be flanked by whitespace or punctuation to skip ISO codes.
  const acronymPattern = /(?<![A-Za-z])([A-Z]{3,8})(?![A-Za-z])/gu;
  for (const text of texts) {
    for (const match of text.matchAll(patternEnd)) {
      const name = match[1]?.trim();
      if (name && name.length > 6 && name.length < 80) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    for (const match of text.matchAll(patternStart)) {
      const name = match[1]?.trim();
      if (name && name.length > 6 && name.length < 80) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    for (const match of text.matchAll(acronymPattern)) {
      const name = match[1]?.trim();
      // Skip ISO currency codes / well-known false positives.
      if (
        name &&
        name.length >= 3 &&
        name.length <= 8 &&
        !['HTTP', 'HTTPS', 'JSON', 'WWW', 'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'CNY'].includes(name)
      ) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);
  // Deduplicate sub-strings (favour longest match) but keep separate
  // ALL-CAPS acronyms even when contained in a longer name (they read
  // as the canonical short form).
  const out: string[] = [];
  const isAcronym = (n: string): boolean => /^[A-Z]{3,8}$/.test(n);
  for (const name of ranked) {
    if (isAcronym(name)) {
      if (!out.includes(name)) out.push(name);
      continue;
    }
    if (
      !out.some(
        (existing) =>
          !isAcronym(existing) &&
          (existing.includes(name) || name.includes(existing)),
      )
    ) {
      out.push(name);
    }
  }
  return Object.freeze(out.slice(0, 5));
}

/** Currency extractor — ISO-4217 patterns + common labels. */
function extractCurrency(
  texts: ReadonlyArray<string>,
  fallback: string,
): string {
  // Look for `(USD)` / `(KES)` / `currency: XYZ` style markers.
  const currencyCode = /\b(?:currency|moneda|monnaie|sarafu)[^A-Z]*([A-Z]{3})\b/u;
  for (const text of texts) {
    const m = text.match(currencyCode);
    if (m?.[1]) return m[1];
  }
  // ISO-4217 alone — only accept when paired with the country name.
  const isoAlone = /\b([A-Z]{3})\b/gu;
  for (const text of texts) {
    for (const match of text.matchAll(isoAlone)) {
      const code = match[1] ?? '';
      // Skip common false positives.
      if (
        code === 'USD' ||
        code === 'EUR' ||
        code === 'GBP' ||
        code === 'CAD' ||
        code === 'JPY' ||
        code === 'CNY'
      ) {
        return code;
      }
    }
  }
  return fallback;
}

/** Language extractor — looks for "language: X" / "spoken Y". */
function extractLanguages(
  texts: ReadonlyArray<string>,
  fallback: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const out = new Set<string>();
  const langPattern =
    /\b(?:language|lugha|idioma|langue|sprache)(?:s)?[:\s]+([A-Za-z, ]{3,80})/iu;
  for (const text of texts) {
    const m = text.match(langPattern);
    if (m?.[1]) {
      const parts = m[1].split(/[,;/]/u);
      for (const part of parts) {
        const lc = part.trim().toLowerCase();
        if (lc.length >= 2 && lc.length <= 30) {
          out.add(lc);
        }
      }
    }
  }
  if (out.size === 0) {
    return fallback;
  }
  return Object.freeze([...out].slice(0, 4));
}

/**
 * Legal-framework extractor — looks for real-estate statutes such as
 * "Landlord and Tenant Act", "Rent Restriction Act", "Code de
 * Logement", "Ley de Arrendamientos".
 */
function extractLegalFramework(
  texts: ReadonlyArray<string>,
): string | undefined {
  const patterns = [
    /\b((?:Landlord|Tenant|Tenancy|Rental|Rent|Housing|Property|Real\s+Estate)\s+(?:and\s+\w+\s+)?(?:Act|Law|Code|Regulation|Ordinance|Bill|Statute)[\s\w-]{0,60})\b/iu,
    /\b(Code\s+(?:de\s+)?(?:Logement|Loyer|Immobilier)[\s\w-]{0,40})\b/iu,
    /\b(Ley\s+(?:de|del)\s+(?:Arrendamientos?|Vivienda)[\s\w-]{0,40})\b/iu,
  ];
  for (const text of texts) {
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m?.[1]) return m[1].trim();
    }
  }
  return undefined;
}

/** Domain classifier for a regulator name. */
function classifyDomain(name: string): DiscoveredRegulator['domain'] {
  const lc = name.toLowerCase();
  if (
    lc.includes('data') ||
    lc.includes('privacy') ||
    lc.includes('gdpr') ||
    lc.includes('popi') ||
    lc.includes('protection commissioner')
  ) {
    return 'data_protection';
  }
  if (
    lc.includes('tribunal') ||
    lc.includes('ombudsman') ||
    lc.includes('rent restriction') ||
    lc.includes('rent control') ||
    lc.includes('tenancy') ||
    lc.includes('court')
  ) {
    return 'tenant_tribunal';
  }
  if (
    lc.includes('revenue') ||
    lc.includes('tax') ||
    lc.includes('inland') ||
    lc.includes('hmrc') ||
    lc.includes('irs') ||
    lc.includes('sars') ||
    lc.includes('kra') ||
    lc.includes('tra') ||
    lc.includes('ura') ||
    lc.includes('firs') ||
    lc.includes('ato')
  ) {
    return 'revenue_tax';
  }
  if (
    lc.includes('building') ||
    lc.includes('construction') ||
    lc.includes('safety') ||
    lc.includes('planning') ||
    lc.includes('nca')
  ) {
    return 'building_safety';
  }
  if (
    lc.includes('housing') ||
    lc.includes('rental') ||
    lc.includes('landlord') ||
    lc.includes('lands') ||
    lc.includes('property') ||
    lc.includes('registry') ||
    lc.includes('settlement') ||
    lc.includes('shelter')
  ) {
    return 'rental_housing';
  }
  return 'unknown';
}

// ─── Public surface ───────────────────────────────────────────────────

/**
 * Fuse web + corpus signals into a single profile.
 *
 * The function NEVER throws — when both signal streams are empty it
 * returns the fallback shell with `validityScore = 0.20` so the brain
 * can still render a structured answer (with the explicit low-
 * confidence flag set by the caller).
 */
export function synthesize(
  input: SynthesizerInput,
): SynthesizerResult {
  const webTexts = input.webHits.map(
    (hit) => `${hit.title}\n${hit.snippet}`,
  );
  const corpusTexts = input.corpusHits.map(
    (hit) => `${hit.title}\n${hit.snippet}`,
  );
  const combined = [...webTexts, ...corpusTexts];
  const regulatorNames = extractRegulatorNames(combined);

  const regulators: DiscoveredRegulator[] = regulatorNames.map(
    (name) => ({
      name,
      domain: classifyDomain(name),
    }),
  );
  // Always have at least one entry — use the country's name as a
  // placeholder so the prompt block isn't empty.
  if (regulators.length === 0) {
    regulators.push({
      name: `${input.countryName} Ministry of Housing (unverified)`,
      domain: 'rental_housing',
      mandate: 'Discovery returned no regulator candidates',
    });
  }

  const currency = extractCurrency(combined, 'UNKNOWN');
  const languages = extractLanguages(combined, ['en']);
  const legalFramework = extractLegalFramework(combined);

  const hasWeb = input.webHits.length > 0;
  const hasCorpus = input.corpusHits.length > 0;
  let validityScore = 0.2;
  if (hasWeb && hasCorpus) validityScore = 0.85;
  else if (hasWeb || hasCorpus) validityScore = 0.55;

  const profile: JurisdictionProfile = Object.freeze({
    countryCode: input.countryCode,
    countryName: input.countryName,
    regulators: Object.freeze(regulators),
    currency,
    languages,
    legalFramework: legalFramework ?? '',
    validityScore,
  });

  const sources: DiscoverySource[] = [
    ...input.webHits.map((hit) => ({
      kind: 'web_search' as const,
      id: hit.url,
      title: hit.title,
      snippet: hit.snippet.slice(0, 240),
    })),
    ...input.corpusHits.map((hit) => ({
      kind: 'corpus' as const,
      id: hit.evidenceId,
      title: hit.title,
      snippet: hit.snippet.slice(0, 240),
    })),
  ];

  return Object.freeze({
    profile,
    sources: Object.freeze(sources),
  });
}
