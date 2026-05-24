/**
 * Carbon methodology matcher — VCS / GS / PACM / CAR / ACR / Plan Vivo / Puro.
 *
 * Pure data + tiny pure matcher.
 *
 * Reference: `.audit/sota-2026-05-24/05-green-angle-advisor.md` §3.
 */

import type {
  CarbonMethodology,
  GreenOpportunity,
  ProjectProfile,
} from '../types.js';

export const CARBON_METHODOLOGY_CATALOG: readonly CarbonMethodology[] = [
  // Verra VCS
  {
    id: 'VCS-VM0007',
    registry: 'VCS',
    title: 'REDD+ (jurisdictional + project)',
    projectTypes: ['agriculture', 'hospitality'],
    requiredSignals: ['critical-habitat-near'],
    reference: 'https://verra.org/methodologies/vm0007-redd-methodology-framework-redd-mf-v1-6/',
  },
  {
    id: 'VCS-VM0009',
    registry: 'VCS',
    title: 'Avoided Ecosystem Conversion',
    projectTypes: ['agriculture', 'mining'],
    requiredSignals: [],
    reference: 'https://verra.org/methodologies/vm0009/',
  },
  {
    id: 'VCS-VM0033',
    registry: 'VCS',
    title: 'Tidal Wetland & Seagrass Restoration (Blue Carbon)',
    projectTypes: ['infrastructure-port', 'hospitality', 'water'],
    requiredSignals: ['coastal-asset'],
    reference: 'https://verra.org/methodologies/vm0033-methodology-for-tidal-wetland-and-seagrass-restoration-v2-0/',
  },
  {
    id: 'VCS-VM0035',
    registry: 'VCS',
    title: 'Coastal Wetland Creation',
    projectTypes: ['infrastructure-port', 'water'],
    requiredSignals: ['coastal-asset'],
    reference: 'https://verra.org/methodologies/vm0035/',
  },
  {
    id: 'VCS-VM0042',
    registry: 'VCS',
    title: 'Improved Agricultural Land Management',
    projectTypes: ['agriculture', 'infrastructure-rail', 'infrastructure-highway', 'mining'],
    requiredSignals: [],
    reference: 'https://verra.org/methodologies/vm0042-methodology-for-improved-agricultural-land-management-v2-0/',
  },
  {
    id: 'VCS-VM0044',
    registry: 'VCS',
    title: 'Biochar Utilisation in Soil & Non-soil',
    projectTypes: ['agriculture', 'industrial', 'infrastructure-port'],
    requiredSignals: [],
    reference: 'https://verra.org/methodologies/vm0044/',
  },
  {
    id: 'VCS-VM0047',
    registry: 'VCS',
    title: 'Afforestation, Reforestation & Revegetation (AR)',
    projectTypes: ['agriculture', 'mining'],
    requiredSignals: [],
    reference: 'https://verra.org/methodologies/vm0047/',
  },
  {
    id: 'VCS-VM0048',
    registry: 'VCS',
    title: 'Reducing Emissions from Deforestation (UDF)',
    projectTypes: ['agriculture', 'hospitality'],
    requiredSignals: ['protected-area-near'],
    reference: 'https://verra.org/methodologies/vm0048/',
  },
  {
    id: 'VCS-VMR0006',
    registry: 'VCS',
    title: 'Modal Shift in Freight Transport',
    projectTypes: ['infrastructure-rail', 'infrastructure-port'],
    requiredSignals: ['freight'],
    reference: 'https://verra.org/methodologies/vmr0006-energy-efficiency-and-fuel-switching-measures-in-thermal-applications-v1-2/',
  },
  // Gold Standard
  {
    id: 'GS-LUF-AR',
    registry: 'GS',
    title: 'GS LUF — Afforestation / Reforestation',
    projectTypes: ['agriculture', 'mining'],
    requiredSignals: [],
    reference: 'https://www.goldstandard.org/our-work/land-use',
  },
  {
    id: 'GS-EE-Cookstove',
    registry: 'GS',
    title: 'GS Energy Efficiency — Cookstoves',
    projectTypes: ['energy', 'mining', 'agriculture', 'infrastructure-rail', 'infrastructure-port'],
    requiredSignals: ['community-adjacent'],
    reference: 'https://www.goldstandard.org/project-developers/standard-documents',
  },
  {
    id: 'GS-RE-SmallHydro',
    registry: 'GS',
    title: 'GS Renewable Energy — Small Hydro / PV / Wind',
    projectTypes: ['energy'],
    requiredSignals: [],
    reference: 'https://www.goldstandard.org/our-work/renewable-energy',
  },
  // Article 6.4 PACM
  {
    id: 'PACM-Removals',
    registry: 'PACM',
    title: 'Paris Agreement Crediting Mechanism — Removals (A/R, biochar, BECCS, DAC)',
    projectTypes: ['agriculture', 'industrial', 'mining'],
    requiredSignals: [],
    reference: 'https://unfccc.int/process-and-meetings/the-paris-agreement/article-64-mechanism',
  },
  {
    id: 'PACM-Avoidance',
    registry: 'PACM',
    title: 'PACM — Avoided deforestation in low-deforestation jurisdictions',
    projectTypes: ['agriculture', 'hospitality'],
    requiredSignals: ['protected-area-near'],
    reference: 'https://unfccc.int/process-and-meetings/the-paris-agreement/article-64-mechanism',
  },
  // ACR
  {
    id: 'ACR-AdvRef',
    registry: 'ACR',
    title: 'ACR Advanced Refrigeration v2.0',
    projectTypes: ['retail', 'industrial', 'commercial-office'],
    requiredSignals: [],
    reference: 'https://americancarbonregistry.org/carbon-accounting/standards-methodologies',
  },
  // Puro.earth durable removals
  {
    id: 'Puro-Biochar',
    registry: 'Puro',
    title: 'Puro.earth Biochar Methodology',
    projectTypes: ['agriculture', 'industrial'],
    requiredSignals: [],
    reference: 'https://puro.earth/',
  },
];

/**
 * Match methodologies to a project profile + the opportunities chosen
 * for that project (so we only surface methodologies whose adjacent
 * opportunity also scored well).
 */
export function matchMethodologies(
  profile: ProjectProfile,
  opportunities: readonly GreenOpportunity[],
): readonly CarbonMethodology[] {
  const oppIds = new Set(opportunities.map((o) => o.id));

  return CARBON_METHODOLOGY_CATALOG.filter((m) => {
    const typeOk = m.projectTypes.some((t) => profile.projectTypes.includes(t));
    if (!typeOk) return false;
    const sigOk =
      m.requiredSignals.length === 0 ||
      m.requiredSignals.every((s) => profile.signals.includes(s));
    if (!sigOk) return false;
    // Require at least one related opportunity to be selected
    if (!hasRelatedOpportunity(m.id, oppIds)) return false;
    return true;
  });
}

function hasRelatedOpportunity(methodologyId: string, oppIds: Set<string>): boolean {
  const mapping: Readonly<Record<string, readonly string[]>> = {
    'VCS-VM0007': ['eco-tourism-credit'],
    'VCS-VM0009': ['land-bng', 'regen-ag-corridor'],
    'VCS-VM0033': ['mangrove-restoration', 'seagrass-restoration'],
    'VCS-VM0035': ['mangrove-restoration', 'seagrass-restoration'],
    'VCS-VM0042': ['regen-ag-corridor'],
    'VCS-VM0044': ['biochar'],
    'VCS-VM0047': ['urban-forestry', 'regen-ag-corridor', 'land-bng'],
    'VCS-VM0048': ['eco-tourism-credit'],
    'VCS-VMR0006': ['modal-shift-freight'],
    'GS-LUF-AR': ['urban-forestry', 'regen-ag-corridor'],
    'GS-EE-Cookstove': ['cookstove-credits'],
    'GS-RE-SmallHydro': ['solar-pv-roof', 'corridor-solar', 'mine-pit-hydro'],
    'PACM-Removals': ['biochar', 'regen-ag-corridor', 'urban-forestry'],
    'PACM-Avoidance': ['eco-tourism-credit'],
    'ACR-AdvRef': ['refrigerant-transition'],
    'Puro-Biochar': ['biochar'],
  };
  const related = mapping[methodologyId] ?? [];
  return related.some((id) => oppIds.has(id));
}

export function findMethodologyById(id: string): CarbonMethodology | undefined {
  return CARBON_METHODOLOGY_CATALOG.find((m) => m.id === id);
}
