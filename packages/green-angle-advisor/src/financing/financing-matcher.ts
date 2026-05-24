/**
 * Financing matcher — ranks instruments per project + opportunities.
 *
 * Scoring (deterministic):
 *   typeOk   = 0.5  if project type intersects eligible types
 *   catOk    = 0.0 - 0.3 by fraction of opportunity categories covered
 *   regionOk = 0.2 if project jurisdiction is supported
 *
 * Pure. No I/O. No LLM.
 */

import type {
  FinancingMatch,
  GreenOpportunity,
  ProjectProfile,
} from '../types.js';
import { GREEN_FINANCE_CATALOG } from './green-finance-catalog.js';

export interface FinancingMatchOptions {
  readonly minScore?: number;
  readonly maxResults?: number;
}

export function matchFinancing(
  profile: ProjectProfile,
  opportunities: readonly GreenOpportunity[],
  options: FinancingMatchOptions = {},
): readonly FinancingMatch[] {
  const minScore = options.minScore ?? 0.5;
  const oppCats = new Set(opportunities.map((o) => o.category));

  const scored: FinancingMatch[] = GREEN_FINANCE_CATALOG.map((instrument) => {
    const typeOk = instrument.eligibleProjectTypes.some((t) => profile.projectTypes.includes(t))
      ? 0.5
      : 0;
    const catHits = instrument.eligibleCategories.filter((c) => oppCats.has(c)).length;
    const catFrac = oppCats.size === 0 ? 0 : catHits / oppCats.size;
    const catOk = Math.min(0.3, catFrac * 0.3);
    const regionOk = instrument.regions.some((r) => profile.jurisdictions.includes(r)) ? 0.2 : 0;
    const score = Math.min(1, typeOk + catOk + regionOk);
    const gates = buildGates(instrument.id, profile);
    const match: FinancingMatch = {
      instrument,
      score,
      rationale: buildRationale(instrument.name, typeOk, catHits, regionOk),
      gatesToClear: gates,
    };
    return match;
  });

  const filtered = scored.filter((m) => m.score >= minScore);
  const sorted = [...filtered].sort((a, b) => b.score - a.score);
  return options.maxResults !== undefined ? sorted.slice(0, options.maxResults) : sorted;
}

function buildRationale(
  name: string,
  typeOk: number,
  catHits: number,
  regionOk: number,
): string {
  const parts: string[] = [];
  if (typeOk > 0) parts.push('project type is eligible');
  if (catHits > 0) parts.push(`${catHits} category fit`);
  if (regionOk > 0) parts.push('jurisdiction supported');
  return parts.length > 0 ? `${name}: ${parts.join('; ')}.` : `${name}: weak fit.`;
}

function buildGates(instrumentId: string, profile: ProjectProfile): readonly string[] {
  const gates: string[] = [];
  if (instrumentId === 'icma-green-bond' || instrumentId === 'icma-sustainability-bond') {
    gates.push('Second-Party Opinion (SPO) from approved reviewer');
    gates.push('Use-of-proceeds tracking framework');
    gates.push('Annual allocation + impact reporting');
  }
  if (instrumentId === 'icma-slb' || instrumentId === 'lma-sll') {
    gates.push('Material KPI selection with SBTi/TPT alignment');
    gates.push('Calibrated SPT (Sustainability Performance Target) trajectory');
    gates.push('External verification provider engagement');
  }
  if (instrumentId === 'lma-green-loan') {
    gates.push('Green-Loan-Principles-aligned framework');
    gates.push('Independent verification (annual)');
  }
  if (instrumentId === 'gcf') {
    gates.push('Accredited Entity (AE) sponsor — only AEs can apply');
    gates.push('Country no-objection letter from NDA');
    gates.push('GCF investment criteria assessment');
  }
  if (instrumentId === 'afdb-sefa' || instrumentId === 'afdb-aaap') {
    gates.push('AfDB country office engagement');
    gates.push('Project Concept Note submission');
  }
  if (instrumentId === 'afdb-afr100') {
    gates.push('AFR100 country signatory status verified');
    gates.push('Landscape restoration pledge endorsed');
  }
  if (instrumentId === 'ifc-edge') {
    gates.push('Design phase EDGE registration');
    gates.push('Final EDGE certification post-construction');
  }
  if (instrumentId === 'ep5') {
    gates.push('Environmental & Social Risk Categorisation (A/B/C)');
    gates.push('Climate transition plan (high-risk projects)');
    gates.push('Stakeholder engagement plan');
    if (profile.signals.includes('critical-habitat-near')) {
      gates.push('IFC PS6 critical-habitat assessment');
    }
  }
  return gates;
}
