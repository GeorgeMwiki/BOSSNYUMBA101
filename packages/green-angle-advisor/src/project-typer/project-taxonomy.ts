/**
 * Project-type taxonomy — 14 canonical profiles.
 *
 * Each profile carries:
 *   - characteristic biome / signal priors (used when classifier
 *     has weak structured signals)
 *   - hot green-angle hints (used as tie-breakers in the matcher)
 *
 * Pure data. No runtime, no I/O.
 *
 * Reference: `.audit/sota-2026-05-24/05-green-angle-advisor.md` §1.
 */

import type { Biome, ProjectType, SectorSignal } from '../types.js';

export interface ProjectTypeProfile {
  readonly type: ProjectType;
  readonly label: string;
  readonly characteristicBiomes: readonly Biome[];
  readonly characteristicSignals: readonly SectorSignal[];
  readonly hotAngleIds: readonly string[];
  readonly notes: string;
}

export const PROJECT_TYPE_PROFILES: readonly ProjectTypeProfile[] = [
  {
    type: 'residential',
    label: 'Residential',
    characteristicBiomes: ['urban'],
    characteristicSignals: ['point-asset', 'urban-heat-island'],
    hotAngleIds: ['solar-pv-roof', 'water-reclaim', 'urban-forestry', 'embodied-carbon-timber'],
    notes: 'IFC EDGE + green-bond-eligible across all tiers',
  },
  {
    type: 'commercial-office',
    label: 'Commercial Office',
    characteristicBiomes: ['urban'],
    characteristicSignals: ['point-asset', 'urban-heat-island'],
    hotAngleIds: ['solar-pv-roof', 'district-cooling', 'smart-grid-dr', 'green-roof'],
    notes: 'LEED/EDGE certified buildings unlock green-loan margin discounts',
  },
  {
    type: 'retail',
    label: 'Retail',
    characteristicBiomes: ['urban'],
    characteristicSignals: ['point-asset', 'multi-site'],
    hotAngleIds: ['solar-pv-roof', 'ev-charging-hub', 'refrigerant-transition'],
    notes: 'Cold-chain refrigerant transition + PV canopy on parking lots',
  },
  {
    type: 'hospitality',
    label: 'Hospitality',
    characteristicBiomes: ['coastal', 'urban', 'tropical-forest'],
    characteristicSignals: ['point-asset', 'community-adjacent'],
    hotAngleIds: ['water-reclaim', 'mangrove-restoration', 'coral-restoration', 'eco-tourism-credit'],
    notes: 'Coastal hospitality particularly suited to blue-carbon + coral restoration',
  },
  {
    type: 'industrial',
    label: 'Industrial',
    characteristicBiomes: ['industrial'],
    characteristicSignals: ['point-asset'],
    hotAngleIds: ['process-heat-electrification', 'waste-heat-capture', 'solar-pv-roof', 'biochar'],
    notes: 'Process-heat electrification is the largest single decarb lever',
  },
  {
    type: 'infrastructure-rail',
    label: 'Infrastructure: Rail',
    characteristicBiomes: ['agricultural', 'savanna', 'urban', 'coastal'],
    characteristicSignals: ['linear-corridor', 'freight', 'passenger'],
    hotAngleIds: [
      'corridor-solar',
      'land-bridge-bng',
      'modal-shift-freight',
      'water-reclaim',
      'regen-ag-corridor',
    ],
    notes: 'Linear infrastructure — long ROW unlocks corridor solar + freight modal-shift credits',
  },
  {
    type: 'infrastructure-port',
    label: 'Infrastructure: Port',
    characteristicBiomes: ['coastal', 'mangrove'],
    characteristicSignals: ['point-asset', 'coastal-asset', 'freight'],
    hotAngleIds: ['shore-power', 'mangrove-restoration', 'modal-shift-freight', 'biochar'],
    notes: 'Shore power + blue-carbon at ports is the dominant decarb path',
  },
  {
    type: 'infrastructure-airport',
    label: 'Infrastructure: Airport',
    characteristicBiomes: ['urban', 'agricultural'],
    characteristicSignals: ['point-asset'],
    hotAngleIds: ['solar-pv-roof', 'saf-offtake', 'urban-forestry'],
    notes: 'SAF demand aggregation is the long-dated lever; roof PV is the near-term win',
  },
  {
    type: 'infrastructure-highway',
    label: 'Infrastructure: Highway',
    characteristicBiomes: ['agricultural', 'savanna', 'urban'],
    characteristicSignals: ['linear-corridor'],
    hotAngleIds: [
      'corridor-solar',
      'land-bridge-bng',
      'ev-charging-hub',
      'water-reclaim',
    ],
    notes: 'Same linear-asset patterns as rail but freight modal-shift is reversed',
  },
  {
    type: 'mining',
    label: 'Mining',
    characteristicBiomes: ['savanna', 'arid', 'semi-arid', 'tropical-forest'],
    characteristicSignals: ['point-asset', 'critical-habitat-near'],
    hotAngleIds: ['mine-pit-hydro', 'riparian-buffer', 'land-bng', 'methane-abatement'],
    notes: 'Progressive rehabilitation + post-closure pumped hydro converts liabilities to assets',
  },
  {
    type: 'energy',
    label: 'Energy',
    characteristicBiomes: ['arid', 'semi-arid', 'industrial', 'savanna'],
    characteristicSignals: ['point-asset', 'high-insolation', 'high-wind-resource'],
    hotAngleIds: [
      'solar-pv-roof',
      'battery-storage-colocation',
      'hydrogen-coproduction',
      'methane-abatement',
    ],
    notes: 'Battery storage + grid services is the highest-IRR adjacent revenue stream',
  },
  {
    type: 'agriculture',
    label: 'Agriculture',
    characteristicBiomes: ['agricultural', 'savanna', 'tropical-forest'],
    characteristicSignals: ['multi-site', 'community-adjacent'],
    hotAngleIds: ['regen-ag-corridor', 'biochar', 'riparian-buffer', 'anaerobic-digestion'],
    notes: 'VM0042 + VM0044 (biochar) yields stacked credit revenue + yield resilience',
  },
  {
    type: 'water',
    label: 'Water',
    characteristicBiomes: ['wetland', 'agricultural', 'urban'],
    characteristicSignals: ['point-asset', 'water-stressed'],
    hotAngleIds: ['water-reclaim', 'watershed-pes', 'anaerobic-digestion', 'riparian-buffer'],
    notes: 'Watershed PES schemes can underwrite long-dated CAPEX recovery',
  },
  {
    type: 'telecom',
    label: 'Telecom',
    characteristicBiomes: ['urban', 'industrial'],
    characteristicSignals: ['multi-site', 'point-asset'],
    hotAngleIds: ['solar-pv-roof', 'waste-heat-capture', 'battery-storage-colocation'],
    notes: 'Data-centre liquid cooling + waste-heat district scheme — biggest grid impact',
  },
];

export function profileForType(type: ProjectType): ProjectTypeProfile {
  const found = PROJECT_TYPE_PROFILES.find((p) => p.type === type);
  if (!found) {
    throw new Error(`Unknown project type: ${type}`);
  }
  return found;
}
