/**
 * Project classifier — heuristic NLP tagger.
 *
 * Maps free-form project descriptions into a ProjectProfile.
 *
 * Strategy:
 *   1. Tokenise prose; lowercase; strip punctuation.
 *   2. Apply keyword dictionaries per ProjectType / Biome / Signal.
 *   3. Match jurisdictions by both ISO codes AND location names
 *      (e.g. "Dar es Salaam" → TZ).
 *   4. Compute confidence as Jaccard of matched signals over the
 *      type's characteristic signal set.
 *   5. Caller-provided `hints` always override / merge with derived
 *      tags (caller knows best).
 *
 * Pure. No I/O. No LLM. The LLM fallback is implemented in the
 * advisor layer via an injected MultiLLMSynthesizerPort.
 */

import {
  type Biome,
  type Jurisdiction,
  type ProjectDescription,
  type ProjectProfile,
  type ProjectType,
  type SectorSignal,
  ProjectDescriptionSchema,
} from '../types.js';
import { profileForType } from './project-taxonomy.js';

// ─────────────────────────────────────────────────────────────────
// Keyword dictionaries
// ─────────────────────────────────────────────────────────────────

const PROJECT_TYPE_KEYWORDS: Readonly<Record<ProjectType, readonly string[]>> = {
  residential: [
    'residential',
    'apartment',
    'apartments',
    'housing',
    'condo',
    'flats',
    'tower',
    'mixed-use housing',
  ],
  'commercial-office': [
    'office',
    'offices',
    'cbd',
    'corporate hq',
    'business park',
    'commercial building',
    'commercial tower',
  ],
  retail: ['retail', 'mall', 'shopping centre', 'shopping center', 'big-box', 'high street', 'supermarket'],
  hospitality: ['hotel', 'hotels', 'resort', 'lodge', 'safari camp', 'guest house', 'hospitality'],
  industrial: [
    'factory',
    'warehouse',
    'industrial',
    'manufacturing',
    'plant',
    'foundry',
    'refinery',
    'cement',
  ],
  'infrastructure-rail': [
    'railway',
    'railroad',
    'rail',
    'sgr',
    'metro',
    'light rail',
    'lrt',
    'brt rail',
    'tram',
    'commuter rail',
  ],
  'infrastructure-port': ['port', 'seaport', 'harbour', 'harbor', 'terminal', 'container terminal', 'jetty'],
  'infrastructure-airport': ['airport', 'runway', 'terminal building', 'airstrip', 'aerodrome', 'mro facility'],
  'infrastructure-highway': [
    'highway',
    'expressway',
    'motorway',
    'toll road',
    'bypass',
    'freeway',
    'arterial road',
  ],
  mining: ['mine', 'mining', 'open-pit', 'underground mine', 'mineral processing', 'quarry'],
  energy: [
    'power plant',
    'wind farm',
    'solar farm',
    'pv plant',
    'geothermal',
    'hydro plant',
    'transmission',
    'substation',
    'gas plant',
    'energy plant',
  ],
  agriculture: ['plantation', 'farm', 'agroforestry', 'irrigation scheme', 'agricultural'],
  water: ['reservoir', 'desalination', 'water treatment', 'sewer', 'wastewater', 'irrigation network'],
  telecom: ['data centre', 'data center', 'cell tower', 'fibre', 'telecom', 'edge dc'],
};

const BIOME_KEYWORDS: Readonly<Record<Biome, readonly string[]>> = {
  coastal: ['coast', 'coastal', 'shore', 'seaside', 'beach', 'estuary'],
  mangrove: ['mangrove', 'tidal forest'],
  wetland: ['wetland', 'marsh', 'swamp', 'floodplain'],
  urban: ['urban', 'city', 'town', 'cbd', 'downtown', 'inner city'],
  arid: ['desert', 'arid'],
  'semi-arid': ['semi-arid', 'drylands', 'sahel'],
  savanna: ['savanna', 'savannah', 'bushveld'],
  'tropical-forest': ['rainforest', 'tropical forest', 'jungle'],
  highland: ['highland', 'highlands', 'mountain', 'plateau'],
  agricultural: ['farmland', 'agricultural land', 'cropland', 'pastoral'],
  industrial: ['industrial zone', 'industrial park', 'sez', 'epz'],
};

const SIGNAL_KEYWORDS: Readonly<Record<SectorSignal, readonly string[]>> = {
  'linear-corridor': ['corridor', 'route', 'line from', 'between', 'connecting'],
  'point-asset': ['site', 'plot', 'parcel', 'campus'],
  'multi-site': ['multiple sites', 'portfolio', 'network of', 'sites across'],
  'coastal-asset': ['port', 'jetty', 'beachfront', 'shoreline'],
  freight: ['freight', 'cargo', 'goods', 'container'],
  passenger: ['passenger', 'commuter', 'travellers'],
  'mixed-use': ['mixed-use', 'mixed use'],
  'critical-habitat-near': ['national park', 'reserve', 'critical habitat', 'wildlife park'],
  'protected-area-near': ['protected area', 'forest reserve', 'wma', 'conservancy'],
  'water-stressed': ['water-stressed', 'drought', 'dry region', 'low rainfall'],
  'high-insolation': ['sunny', 'high insolation', 'arid plateau'],
  'high-wind-resource': ['windy', 'high wind'],
  'high-rainfall': ['high rainfall', 'wet season', 'tropical rainfall'],
  'low-rainfall': ['low rainfall', 'arid'],
  'community-adjacent': ['village', 'town', 'community', 'residents'],
  'urban-heat-island': ['urban heat', 'heat island'],
};

// Jurisdictions: ISO codes + canonical location names that imply them.
const JURISDICTION_KEYWORDS: Readonly<Record<Jurisdiction, readonly string[]>> = {
  KE: ['kenya', 'nairobi', 'mombasa', 'kisumu', 'naivasha', 'eldoret', ' ke '],
  TZ: ['tanzania', 'dar es salaam', 'dodoma', 'arusha', 'mwanza', 'mbeya', 'zanzibar', ' tz '],
  UG: ['uganda', 'kampala', 'jinja', 'entebbe', ' ug '],
  RW: ['rwanda', 'kigali', ' rw '],
  BI: ['burundi', 'bujumbura', ' bi '],
  ET: ['ethiopia', 'addis ababa', ' et '],
  ZA: ['south africa', 'johannesburg', 'cape town', 'durban', ' za '],
  NG: ['nigeria', 'lagos', 'abuja', ' ng '],
  GH: ['ghana', 'accra', ' gh '],
  EG: ['egypt', 'cairo', 'alexandria', ' eg '],
  EU: [' eu ', 'european union', 'eurozone'],
  UK: ['united kingdom', 'britain', 'england', 'scotland', 'wales', 'london'],
  US: ['united states', 'usa', ' us '],
  OTHER: [],
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

function matchKeys<K extends string>(
  haystack: string,
  dict: Readonly<Record<K, readonly string[]>>,
): K[] {
  const hits: K[] = [];
  for (const key of Object.keys(dict) as K[]) {
    const kws = dict[key];
    if (kws.some((kw) => haystack.includes(kw))) {
      hits.push(key);
    }
  }
  return hits;
}

function dedupe<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

function jaccard<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Classify a free-form project description into a ProjectProfile.
 *
 * Pure, deterministic, no LLM. For ambiguous prose the advisor layer
 * may post-process with the MultiLLMSynthesizerPort.
 */
export function classifyProject(input: ProjectDescription): ProjectProfile {
  const parsed = ProjectDescriptionSchema.parse(input);
  const text = normalise(parsed.description);

  const derivedTypes = matchKeys(text, PROJECT_TYPE_KEYWORDS);
  const derivedBiomes = matchKeys(text, BIOME_KEYWORDS);
  const derivedSignals = matchKeys(text, SIGNAL_KEYWORDS);
  const derivedJurisdictions = matchKeys(text, JURISDICTION_KEYWORDS);

  // Merge hints (caller-provided wins for explicit declarations).
  const types = dedupe([...(parsed.hints?.projectTypes ?? []), ...derivedTypes]);
  const biomes = dedupe([...(parsed.hints?.biomes ?? []), ...derivedBiomes]);
  const signals = dedupe([...(parsed.hints?.signals ?? []), ...derivedSignals]);
  const jurisdictions = dedupe([
    ...(parsed.hints?.jurisdictions ?? []),
    ...derivedJurisdictions,
  ]);

  // Heuristic: "from X to Y" → linear corridor
  if (/from\s+\w+.+to\s+\w+/i.test(parsed.description) && !signals.includes('linear-corridor')) {
    signals.push('linear-corridor');
  }

  // If we see rail + (coast / port / beach) along corridor → add coastal-asset
  if (types.includes('infrastructure-rail') && biomes.includes('coastal') && !signals.includes('coastal-asset')) {
    signals.push('coastal-asset');
  }

  // Confidence = mean of (typeMatchScore, signalMatchScore, jurisdictionCertainty)
  const typeMatchScore = types.length > 0 ? 1 : 0;
  const signalMatchScore =
    types.length > 0
      ? Math.max(
          ...types.map((t) => jaccard(signals, profileForType(t).characteristicSignals)),
        )
      : 0;
  const jurisdictionCertainty = jurisdictions.length > 0 ? 1 : 0.3;
  const confidence = Math.min(
    1,
    (typeMatchScore * 0.5 + signalMatchScore * 0.3 + jurisdictionCertainty * 0.2),
  );

  const rationale = buildRationale(types, jurisdictions, signals);

  const result: ProjectProfile = {
    projectTypes: types,
    jurisdictions: jurisdictions.length > 0 ? jurisdictions : ['OTHER'],
    biomes,
    signals,
    ...(parsed.hints?.lengthKm !== undefined ? { lengthKm: parsed.hints.lengthKm } : {}),
    ...(parsed.hints?.areaHa !== undefined ? { areaHa: parsed.hints.areaHa } : {}),
    ...(parsed.hints?.capexUsdMillions !== undefined
      ? { capexUsdMillions: parsed.hints.capexUsdMillions }
      : {}),
    confidence,
    rationale,
  };
  return result;
}

function buildRationale(
  types: readonly ProjectType[],
  jurisdictions: readonly Jurisdiction[],
  signals: readonly SectorSignal[],
): string {
  const typeText =
    types.length > 0 ? `Project types detected: ${types.join(', ')}.` : 'No project types detected.';
  const jurText =
    jurisdictions.length > 0
      ? `Jurisdictions: ${jurisdictions.join(', ')}.`
      : 'Jurisdiction unresolved.';
  const sigText = signals.length > 0 ? `Signals: ${signals.join(', ')}.` : '';
  return [typeText, jurText, sigText].filter((s) => s.length > 0).join(' ');
}
