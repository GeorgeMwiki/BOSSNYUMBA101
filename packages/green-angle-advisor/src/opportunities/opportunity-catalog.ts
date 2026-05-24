/**
 * Opportunity catalog — 30+ canonical patterns.
 *
 * Each entry is a deterministic descriptor that the matcher composes
 * per project. Per-pattern matcher modules (bng-opportunity.ts etc.)
 * implement domain-specific volume / value estimation; this file is
 * the registry of WHAT exists and the cheap "does it apply" test.
 *
 * Pure data + tiny pure predicate. No I/O. No LLM.
 *
 * Reference: `.audit/sota-2026-05-24/05-green-angle-advisor.md` §8.
 */

import type {
  Biome,
  OpportunityCategory,
  ProjectProfile,
  ProjectType,
  SectorSignal,
} from '../types.js';

export interface OpportunityDescriptor {
  readonly id: string;
  readonly title: string;
  readonly category: OpportunityCategory;
  readonly oneLiner: string;
  /** Project types this opportunity attaches to. */
  readonly applicableProjectTypes: readonly ProjectType[];
  /** Required biomes — empty array means biome-agnostic. */
  readonly requiredBiomes: readonly Biome[];
  /** Required signals — empty array means signal-agnostic. */
  readonly requiredSignals: readonly SectorSignal[];
  /** Bonus signals — non-required, used to score upward. */
  readonly bonusSignals: readonly SectorSignal[];
  /** Default abatement constant per project unit. */
  readonly defaultAbatementFactor: number;
  /** SDG targets directly served. */
  readonly sdgTargets: readonly number[];
  /** Reference standards / frameworks. */
  readonly references: readonly string[];
}

export const OPPORTUNITY_CATALOG: readonly OpportunityDescriptor[] = [
  // 1. Corridor solar co-location — linear infra
  {
    id: 'corridor-solar',
    title: 'Corridor solar co-location',
    category: 'renewable-energy',
    oneLiner: 'Install PV along right-of-way easements for self-supply + grid export',
    applicableProjectTypes: ['infrastructure-rail', 'infrastructure-highway'],
    requiredBiomes: [],
    requiredSignals: ['linear-corridor'],
    bonusSignals: ['high-insolation'],
    defaultAbatementFactor: 1500, // tCO2e/MW/yr (~5h sun)
    sdgTargets: [7, 9, 13],
    references: ['IRENA Renewable Capacity 2025', 'IFC Performance Standard 3'],
  },
  // 2. Land-bridge BNG — wildlife crossings
  {
    id: 'land-bridge-bng',
    title: 'Land-bridge biodiversity crossings (BNG)',
    category: 'biodiversity',
    oneLiner: 'Wildlife over-pass / under-pass with adjacent biodiversity-net-gain offset',
    applicableProjectTypes: ['infrastructure-rail', 'infrastructure-highway'],
    requiredBiomes: [],
    requiredSignals: ['linear-corridor'],
    bonusSignals: ['critical-habitat-near', 'protected-area-near'],
    defaultAbatementFactor: 0,
    sdgTargets: [15],
    references: ['IFC Performance Standard 6', 'UK BNG Statutory Guidance (Feb 2024)'],
  },
  // 3. Solar PV roof / canopy
  {
    id: 'solar-pv-roof',
    title: 'Solar PV roof / canopy',
    category: 'renewable-energy',
    oneLiner: 'Rooftop / canopy PV self-supply with optional surplus export',
    applicableProjectTypes: [
      'residential',
      'commercial-office',
      'retail',
      'industrial',
      'infrastructure-airport',
      'telecom',
      'energy',
    ],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['point-asset', 'high-insolation', 'urban-heat-island'],
    defaultAbatementFactor: 800, // tCO2e/yr per typical 500kWp install
    sdgTargets: [7, 11, 13],
    references: ['IFC EDGE', 'Kenya Energy Act 2019 + Net-metering Regs 2022'],
  },
  // 4. EV charging hub
  {
    id: 'ev-charging-hub',
    title: 'EV charging hub',
    category: 'transport-emissions',
    oneLiner: 'DC fast-charging hub with optional PV+BESS, queue-side leasing revenue',
    applicableProjectTypes: ['retail', 'infrastructure-highway', 'infrastructure-rail'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['linear-corridor'],
    defaultAbatementFactor: 200,
    sdgTargets: [7, 11, 13],
    references: ['ICCT EV Charging Infra Roadmap 2025'],
  },
  // 5. Battery storage co-location
  {
    id: 'battery-storage-colocation',
    title: 'Battery storage co-location',
    category: 'renewable-energy',
    oneLiner: 'BESS co-located with PV / grid-edge for arbitrage + ancillary services',
    applicableProjectTypes: ['energy', 'commercial-office', 'industrial', 'telecom'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 0, // displacement, not direct
    sdgTargets: [7, 9, 13],
    references: ['BloombergNEF BESS Outlook 2025'],
  },
  // 6. Hydrogen co-production
  {
    id: 'hydrogen-coproduction',
    title: 'Hydrogen co-production',
    category: 'renewable-energy',
    oneLiner: 'Electrolyser co-located with renewable generation for green H2 offtake',
    applicableProjectTypes: ['energy', 'industrial', 'infrastructure-port'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['high-insolation', 'high-wind-resource'],
    defaultAbatementFactor: 9000, // tCO2e/MWel-yr displacement
    sdgTargets: [7, 9, 13],
    references: ['IEA Hydrogen Outlook 2024'],
  },
  // 7. Water reclaim / greywater
  {
    id: 'water-reclaim',
    title: 'Water reclaim / greywater systems',
    category: 'water',
    oneLiner: 'Rainwater + greywater reuse for non-potable demand',
    applicableProjectTypes: [
      'residential',
      'commercial-office',
      'retail',
      'hospitality',
      'industrial',
      'infrastructure-rail',
      'infrastructure-highway',
      'infrastructure-airport',
    ],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['water-stressed', 'high-rainfall'],
    defaultAbatementFactor: 50, // tCO2e via avoided pumped supply
    sdgTargets: [6, 11, 13],
    references: ['IFC EDGE Water Resource', 'IWA Water Efficiency Guidelines 2024'],
  },
  // 8. Sustainable urban drainage / SuDS
  {
    id: 'suds-stations',
    title: 'Sustainable urban drainage at stations / nodes',
    category: 'water',
    oneLiner: 'SuDS basins, bioswales, permeable surfaces around stations + nodes',
    applicableProjectTypes: [
      'infrastructure-rail',
      'infrastructure-highway',
      'commercial-office',
      'retail',
    ],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['high-rainfall', 'urban-heat-island'],
    defaultAbatementFactor: 20,
    sdgTargets: [6, 11, 13],
    references: ['CIRIA SuDS Manual C753'],
  },
  // 9. Mangrove restoration (blue carbon)
  {
    id: 'mangrove-restoration',
    title: 'Mangrove restoration (blue carbon)',
    category: 'land-use',
    oneLiner: 'Mangrove reforestation creates VCS VM0033 blue-carbon credits + storm protection',
    applicableProjectTypes: ['infrastructure-port', 'hospitality', 'water'],
    requiredBiomes: ['coastal', 'mangrove'],
    requiredSignals: ['coastal-asset'],
    bonusSignals: [],
    defaultAbatementFactor: 1700, // tCO2e/ha/yr early years
    sdgTargets: [13, 14, 15],
    references: ['VCS VM0033', 'IUCN Global Standard for NbS v1.1'],
  },
  // 10. Seagrass restoration (blue carbon)
  {
    id: 'seagrass-restoration',
    title: 'Seagrass restoration (blue carbon)',
    category: 'land-use',
    oneLiner: 'Seagrass restoration yields VCS VM0033 credits + fisheries co-benefits',
    applicableProjectTypes: ['infrastructure-port', 'hospitality'],
    requiredBiomes: ['coastal'],
    requiredSignals: ['coastal-asset'],
    bonusSignals: [],
    defaultAbatementFactor: 800,
    sdgTargets: [13, 14],
    references: ['VCS VM0033'],
  },
  // 11. Urban forestry
  {
    id: 'urban-forestry',
    title: 'Urban forestry programme',
    category: 'land-use',
    oneLiner: 'Tree-planting programme: PM2.5 reduction, heat-island abatement, GS credits',
    applicableProjectTypes: ['residential', 'commercial-office', 'infrastructure-airport'],
    requiredBiomes: ['urban'],
    requiredSignals: [],
    bonusSignals: ['urban-heat-island'],
    defaultAbatementFactor: 40,
    sdgTargets: [3, 11, 13, 15],
    references: ['Gold Standard A/R', 'WHO Urban Green Spaces Guidelines'],
  },
  // 12. Regen ag corridor
  {
    id: 'regen-ag-corridor',
    title: 'Regenerative agriculture corridor',
    category: 'land-use',
    oneLiner: 'Buffer-zone agroforestry: VM0042 soil carbon + livelihood program',
    applicableProjectTypes: ['agriculture', 'infrastructure-rail', 'infrastructure-highway', 'mining'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['linear-corridor', 'community-adjacent'],
    defaultAbatementFactor: 2,
    sdgTargets: [2, 13, 15],
    references: ['VCS VM0042', 'AFR100'],
  },
  // 13. Biochar
  {
    id: 'biochar',
    title: 'Biochar from waste biomass',
    category: 'circular-economy',
    oneLiner: 'Pyrolysis of crop / forest waste into VM0044/VM0048 biochar credits',
    applicableProjectTypes: ['agriculture', 'industrial', 'infrastructure-port'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['community-adjacent'],
    defaultAbatementFactor: 2500,
    sdgTargets: [2, 12, 13],
    references: ['VCS VM0044', 'VCS VM0048', 'Puro.earth Biochar Methodology'],
  },
  // 14. Modal-shift freight
  {
    id: 'modal-shift-freight',
    title: 'Modal-shift freight carbon credit (road → rail / coastal shipping)',
    category: 'transport-emissions',
    oneLiner: 'VMR0006 methodology: baseline = trucks, project = rail/coastal',
    applicableProjectTypes: ['infrastructure-rail', 'infrastructure-port'],
    requiredBiomes: [],
    requiredSignals: ['freight'],
    bonusSignals: ['linear-corridor', 'coastal-asset'],
    defaultAbatementFactor: 200000, // tCO2e/yr for ~5Mt/yr modal shift
    sdgTargets: [9, 11, 13],
    references: ['VCS VMR0006'],
  },
  // 15. Shore power
  {
    id: 'shore-power',
    title: 'Shore power for vessels',
    category: 'transport-emissions',
    oneLiner: 'Cold-ironing at berth eliminates diesel auxiliaries while docked',
    applicableProjectTypes: ['infrastructure-port'],
    requiredBiomes: ['coastal'],
    requiredSignals: ['coastal-asset'],
    bonusSignals: [],
    defaultAbatementFactor: 25000,
    sdgTargets: [3, 9, 13, 14],
    references: ['IMO MEPC.323(74)', 'IAPH Shore Power Whitepaper 2024'],
  },
  // 16. Process-heat electrification
  {
    id: 'process-heat-electrification',
    title: 'Process-heat electrification',
    category: 'energy-efficiency',
    oneLiner: 'Replace fossil-fired process heat with industrial heat pumps + resistance + induction',
    applicableProjectTypes: ['industrial'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 12000,
    sdgTargets: [9, 12, 13],
    references: ['IEA Heat Roadmap 2024', 'RMI Heat Pumps in Industry 2025'],
  },
  // 17. Waste-heat capture / district heat
  {
    id: 'waste-heat-capture',
    title: 'Waste-heat capture / district scheme',
    category: 'energy-efficiency',
    oneLiner: 'Recover process / DC waste heat to feed neighbouring demand',
    applicableProjectTypes: ['industrial', 'telecom'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['community-adjacent'],
    defaultAbatementFactor: 4000,
    sdgTargets: [7, 9, 11, 13],
    references: ['IEA DC Energy Brief 2024'],
  },
  // 18. Refrigerant transition
  {
    id: 'refrigerant-transition',
    title: 'Refrigerant transition (HFC → CO₂ / NH₃ / HFO)',
    category: 'pollution-prevention',
    oneLiner: 'Eliminate high-GWP refrigerants in cold-chain, retail, and HVAC plant',
    applicableProjectTypes: ['retail', 'industrial', 'commercial-office', 'hospitality'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 600,
    sdgTargets: [12, 13],
    references: ['Kigali Amendment to Montreal Protocol', 'ACR Advanced Refrigeration v2.0'],
  },
  // 19. SAF offtake
  {
    id: 'saf-offtake',
    title: 'Sustainable Aviation Fuel (SAF) demand aggregation',
    category: 'transport-emissions',
    oneLiner: 'Long-dated offtake agreement to underwrite SAF production capacity',
    applicableProjectTypes: ['infrastructure-airport'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 50000,
    sdgTargets: [9, 13],
    references: ['ICAO CORSIA', 'IATA SAF Roadmap 2024'],
  },
  // 20. Green hydrogen offtake (port / industrial)
  {
    id: 'green-hydrogen-offtake',
    title: 'Green hydrogen offtake',
    category: 'renewable-energy',
    oneLiner: 'Offtake green H2 for bunkering / process feedstock',
    applicableProjectTypes: ['infrastructure-port', 'industrial'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 8000,
    sdgTargets: [7, 9, 13],
    references: ['IEA Hydrogen Outlook 2024'],
  },
  // 21. Riparian buffer
  {
    id: 'riparian-buffer',
    title: 'Riparian buffer restoration',
    category: 'biodiversity',
    oneLiner: 'Re-vegetate stream banks for water quality + biodiversity + flood control',
    applicableProjectTypes: ['agriculture', 'mining', 'infrastructure-highway', 'infrastructure-rail', 'water'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 15,
    sdgTargets: [6, 14, 15],
    references: ['IUCN Global Standard for NbS v1.1', 'FAO Riparian Forest Guidelines'],
  },
  // 22. Mine-pit pumped hydro
  {
    id: 'mine-pit-hydro',
    title: 'Mine-pit pumped hydro storage',
    category: 'renewable-energy',
    oneLiner: 'Convert closed open-pit + dam into pumped-hydro energy storage',
    applicableProjectTypes: ['mining'],
    requiredBiomes: [],
    requiredSignals: ['point-asset'],
    bonusSignals: [],
    defaultAbatementFactor: 100000,
    sdgTargets: [7, 13, 15],
    references: ['IRENA Pumped Hydro Outlook 2024'],
  },
  // 23. Methane abatement (LDAR + flaring)
  {
    id: 'methane-abatement',
    title: 'Methane abatement (LDAR + flare elimination)',
    category: 'pollution-prevention',
    oneLiner: 'Leak detection + repair + electrification of flares — high-leverage CH₄ tons',
    applicableProjectTypes: ['energy', 'mining', 'agriculture', 'water'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 8000,
    sdgTargets: [13],
    references: ['IEA Methane Tracker 2024', 'OGMP 2.0', 'Global Methane Pledge'],
  },
  // 24. Cookstove distribution credits
  {
    id: 'cookstove-credits',
    title: 'Cookstove distribution carbon credits',
    category: 'community',
    oneLiner: 'Distribute efficient cookstoves in adjacent communities; GS credits',
    applicableProjectTypes: ['energy', 'mining', 'agriculture', 'infrastructure-rail', 'infrastructure-port'],
    requiredBiomes: [],
    requiredSignals: ['community-adjacent'],
    bonusSignals: [],
    defaultAbatementFactor: 3000,
    sdgTargets: [3, 5, 7, 13],
    references: ['Gold Standard TPDDTEC', 'WHO Indoor Air Quality Guidelines'],
  },
  // 25. Embodied-carbon timber
  {
    id: 'embodied-carbon-timber',
    title: 'Mass-timber / CLT/GLT structural substitution',
    category: 'circular-economy',
    oneLiner: 'Replace structural steel + concrete with CLT/GLT for ~40% embodied cut',
    applicableProjectTypes: ['residential', 'commercial-office'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 800,
    sdgTargets: [9, 12, 13, 15],
    references: ['IEA EBC Annex 72', 'TWA Embodied Carbon Toolkit'],
  },
  // 26. Low-carbon cement
  {
    id: 'low-carbon-cement',
    title: 'Low-carbon cement (SCM, CCS, LC3)',
    category: 'pollution-prevention',
    oneLiner: 'Specify CEM IV / LC3 / CCS clinker for major-pour structural concrete',
    applicableProjectTypes: [
      'residential',
      'commercial-office',
      'infrastructure-rail',
      'infrastructure-highway',
      'infrastructure-port',
      'infrastructure-airport',
      'industrial',
    ],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 3000,
    sdgTargets: [9, 12, 13],
    references: ['LC3 Project', 'GCCA 2050 Roadmap', 'CSI Cement Sustainability Initiative'],
  },
  // 27. Watershed PES
  {
    id: 'watershed-pes',
    title: 'Watershed payments for ecosystem services',
    category: 'water',
    oneLiner: 'Pay upstream landowners to maintain catchment quality — long-dated revenue',
    applicableProjectTypes: ['water', 'energy', 'agriculture'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['community-adjacent'],
    defaultAbatementFactor: 0,
    sdgTargets: [6, 13, 15],
    references: ['UNEP State of Finance for Nature 2024', 'IUCN PES Best Practice'],
  },
  // 28. Eco-tourism credit
  {
    id: 'eco-tourism-credit',
    title: 'Eco-tourism revenue + carbon credit stack',
    category: 'community',
    oneLiner: 'Tourism-linked conservation revenue stacked with avoided-deforestation credits',
    applicableProjectTypes: ['hospitality'],
    requiredBiomes: ['tropical-forest', 'savanna', 'coastal'],
    requiredSignals: [],
    bonusSignals: ['protected-area-near', 'critical-habitat-near'],
    defaultAbatementFactor: 10000,
    sdgTargets: [8, 13, 15],
    references: ['VCS VM0007 REDD+', 'TIES Eco-Tourism Standards'],
  },
  // 29. Coral restoration
  {
    id: 'coral-restoration',
    title: 'Coral restoration',
    category: 'biodiversity',
    oneLiner: 'Coral gardens + outplanting: fisheries + shore protection + tourism revenue',
    applicableProjectTypes: ['hospitality', 'infrastructure-port'],
    requiredBiomes: ['coastal'],
    requiredSignals: ['coastal-asset'],
    bonusSignals: [],
    defaultAbatementFactor: 0,
    sdgTargets: [14, 15],
    references: ['IUCN Coral Restoration Standards', 'NOAA Coral Reef Conservation Program'],
  },
  // 30. Smart grid / demand response
  {
    id: 'smart-grid-dr',
    title: 'Smart grid / demand response participation',
    category: 'energy-efficiency',
    oneLiner: 'Participate in DR programmes — shed load on price/grid signals for revenue',
    applicableProjectTypes: ['commercial-office', 'industrial', 'telecom', 'retail'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 500,
    sdgTargets: [7, 9, 13],
    references: ['NERC Reliability Standards', 'IEA DSF Status Report 2024'],
  },
  // 31. Green roof / walls
  {
    id: 'green-roof',
    title: 'Green roofs / living walls',
    category: 'climate-adaptation',
    oneLiner: 'Green roofs / walls: heat-island mitigation + stormwater + biodiversity',
    applicableProjectTypes: ['commercial-office', 'residential', 'retail'],
    requiredBiomes: ['urban'],
    requiredSignals: [],
    bonusSignals: ['urban-heat-island', 'high-rainfall'],
    defaultAbatementFactor: 10,
    sdgTargets: [11, 13, 15],
    references: ['Singapore BCA Greenery Provision Act', 'EFB Green Roof Guidelines'],
  },
  // 32. Anaerobic digestion / biogas
  {
    id: 'anaerobic-digestion',
    title: 'Anaerobic digestion / biogas',
    category: 'circular-economy',
    oneLiner: 'Sludge / manure / food-waste AD plant → biogas → CHP or grid injection',
    applicableProjectTypes: ['agriculture', 'water'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: [],
    defaultAbatementFactor: 3000,
    sdgTargets: [7, 12, 13],
    references: ['IEA Bioenergy Task 37', 'CDM AMS-III.AO baseline'],
  },
  // 33. District cooling
  {
    id: 'district-cooling',
    title: 'District cooling network',
    category: 'energy-efficiency',
    oneLiner: 'Centralised chillers + cold-water network: 40-50% kWh cut vs DX',
    applicableProjectTypes: ['commercial-office', 'residential', 'retail'],
    requiredBiomes: ['urban'],
    requiredSignals: ['mixed-use'],
    bonusSignals: ['urban-heat-island'],
    defaultAbatementFactor: 6000,
    sdgTargets: [7, 11, 13],
    references: ['IDEA District Cooling Guidelines', 'IEA District Energy Initiative'],
  },
  // 34. Land BNG (mining)
  {
    id: 'land-bng',
    title: 'Land biodiversity-net-gain (mining)',
    category: 'biodiversity',
    oneLiner: 'Mining-disturbance offsets with progressive rehabilitation + BNG ratio offsets',
    applicableProjectTypes: ['mining'],
    requiredBiomes: [],
    requiredSignals: [],
    bonusSignals: ['critical-habitat-near', 'protected-area-near'],
    defaultAbatementFactor: 0,
    sdgTargets: [15],
    references: ['IFC Performance Standard 6', 'ICMM Mining Principles'],
  },
];

/**
 * Quick predicate: does this opportunity apply to this profile at all?
 *
 * Strict (true) requires: type match AND all required biomes are
 * present (if required) AND all required signals are present (if any).
 *
 * This is the fast filter; full score is computed in opportunity-matcher.
 */
export function isOpportunityApplicable(
  desc: OpportunityDescriptor,
  profile: ProjectProfile,
): boolean {
  const typeOk = desc.applicableProjectTypes.some((t) => profile.projectTypes.includes(t));
  if (!typeOk) return false;

  if (desc.requiredBiomes.length > 0) {
    const biomeOk = desc.requiredBiomes.some((b) => profile.biomes.includes(b));
    if (!biomeOk) return false;
  }
  if (desc.requiredSignals.length > 0) {
    const sigOk = desc.requiredSignals.every((s) => profile.signals.includes(s));
    if (!sigOk) return false;
  }
  return true;
}

export function findOpportunityById(id: string): OpportunityDescriptor | undefined {
  return OPPORTUNITY_CATALOG.find((o) => o.id === id);
}
