/**
 * OM design advisor — 12-section Offering Memorandum outline per
 * IREI OM Standard 2024 and RealNex OM Template Library.
 *
 * Section list is fixed per the standard; this module flags which
 * are required vs optional for a given asset (e.g. tenant profiles
 * for multifamily is "summary roll only").
 */

import type { AssetClass, OMOutline, OMSection } from '../types.js';

interface SectionMeta {
  readonly section: OMSection;
  readonly required: boolean;
  readonly notes: string;
  readonly pages: number;
}

function buildSections(assetClass: AssetClass): ReadonlyArray<SectionMeta> {
  const isMultifamily = assetClass === 'multifamily';
  return [
    { section: 'executive-summary', required: true, notes: '1-2 pp summary; transaction overview', pages: 2 },
    { section: 'investment-highlights', required: true, notes: '3-5 bullet positioning statements', pages: 1 },
    { section: 'property-description', required: true, notes: 'site, building, systems, age, condition', pages: 4 },
    { section: 'location-demographics', required: true, notes: 'CBSA + submarket demographics + drive-times', pages: 3 },
    { section: 'market-overview', required: true, notes: 'submarket vacancy, rent growth, supply pipeline', pages: 4 },
    { section: 'financial-analysis', required: true, notes: 'T-12 + pro-forma + DCF + sensitivity', pages: 6 },
    {
      section: 'tenant-profiles',
      required: !isMultifamily,
      notes: isMultifamily
        ? 'multifamily: summary rent roll only; per-tenant detail not required'
        : 'top-10 tenant profiles (credit, NLA, term, expiry, contraction options)',
      pages: isMultifamily ? 1 : 5,
    },
    { section: 'capital-plan', required: true, notes: 'in-place capex + projected 5-yr capex with sources', pages: 2 },
    { section: 'comparable-sales', required: true, notes: '6-12 recent comparable sales (last 18-24 mo)', pages: 3 },
    { section: 'title-zoning-environmental', required: true, notes: 'title commitment, zoning letter, Phase I ESA', pages: 2 },
    { section: 'tour-offer-process', required: true, notes: 'tour schedule, offer dates, deposit & contingencies', pages: 2 },
    { section: 'disclaimers', required: true, notes: 'IREI standard confidentiality, ND, disclaimers', pages: 2 },
  ];
}

export function designOM(assetId: string, assetClass: AssetClass): OMOutline {
  const sections = buildSections(assetClass);
  const estimatedPages = sections.reduce((s, x) => s + x.pages, 0);
  return {
    assetId,
    sections: sections.map(({ section, required, notes }) => ({
      section,
      required,
      notes,
    })),
    estimatedPages,
  };
}
