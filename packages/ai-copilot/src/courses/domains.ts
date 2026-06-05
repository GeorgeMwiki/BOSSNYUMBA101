/**
 * Course domains — the estate-management topic catalog for the create-course
 * flow's step 1 (domain picker).
 *
 * Ported from LitFin's business-domain registry and retargeted from generic
 * small-business sectors to BossNyumba's estate-management body of knowledge:
 * rent affordability, tenancy law, compliance, repairs, portfolio ops, and the
 * financial spine. Each domain biases the deterministic concept sequencer
 * (`conceptCategory`) toward the right slice of `ESTATE_CONCEPTS` and gives the
 * LLM prompt a human-readable label.
 *
 * Bilingual EN/SW (single-language per render). Isomorphic — safe to import on
 * the FE through the `./courses` subpath export.
 *
 * @module courses/domains
 */

import type { Concept } from '../training/concepts-catalog.js';

/** Concept categories the catalog tags each concept with. */
type ConceptCategory = Concept['category'];

export interface CourseDomain {
  readonly id: string;
  readonly labelEn: string;
  readonly labelSw: string;
  readonly descriptionEn: string;
  readonly descriptionSw: string;
  /** Lucide icon name (rendered on the FE). */
  readonly icon: string;
  /** Concept-catalog category this domain leans on for the fallback sequencer. */
  readonly conceptCategory: ConceptCategory;
  /** Free-text seed the deterministic sequencer scores concepts against. */
  readonly topicSeed: string;
}

export const COURSE_DOMAINS: ReadonlyArray<CourseDomain> = [
  {
    id: 'rent_affordability',
    labelEn: 'Rent affordability & screening',
    labelSw: 'Uwezo wa kulipa kodi na uchunguzi',
    descriptionEn:
      'Income ratios, deposit structures, and tenant screening that keep arrears low.',
    descriptionSw:
      'Uwiano wa mapato, muundo wa amana, na uchunguzi wa mpangaji unaopunguza madeni.',
    icon: 'Wallet',
    conceptCategory: 'financial',
    topicSeed:
      'rent affordability deposit screening income ratio tenant arrears',
  },
  {
    id: 'tenancy_law',
    labelEn: 'Tenancy law & leases',
    labelSw: 'Sheria ya upangaji na mikataba',
    descriptionEn:
      'Lease types, escalation clauses, renewals, terminations, and holdover rules.',
    descriptionSw:
      'Aina za mikataba, vifungu vya kupanda, kuhuisha, kumaliza, na sheria za kubaki.',
    icon: 'Scale',
    conceptCategory: 'tenancy',
    topicSeed:
      'tenancy lease law escalation renewal termination holdover assignment sublet',
  },
  {
    id: 'compliance',
    labelEn: 'Compliance & regulation',
    labelSw: 'Uzingatiaji na kanuni',
    descriptionEn:
      'Data protection, tax, landlord-tenant statute, evidence, and audit trails.',
    descriptionSw:
      'Ulinzi wa data, kodi, sheria ya mwenye-mpangaji, ushahidi, na kumbukumbu za ukaguzi.',
    icon: 'ShieldCheck',
    conceptCategory: 'compliance',
    topicSeed:
      'compliance regulation data protection tax statute evidence audit licence',
  },
  {
    id: 'repairs_maintenance',
    labelEn: 'Repairs & maintenance',
    labelSw: 'Matengenezo na ukarabati',
    descriptionEn:
      'Work-order triage, SLAs, vendor dispatch, planned upkeep, and emergencies.',
    descriptionSw:
      'Mpangilio wa kazi, viwango vya huduma, kupeleka wakandarasi, matunzo, na dharura.',
    icon: 'Wrench',
    conceptCategory: 'maintenance',
    topicSeed:
      'repairs maintenance work order SLA vendor planned upkeep emergency capex',
  },
  {
    id: 'portfolio_ops',
    labelEn: 'Portfolio operations',
    labelSw: 'Uendeshaji wa kundi la mali',
    descriptionEn:
      'Occupancy, turnover, caretaker coordination, and day-to-day estate running.',
    descriptionSw:
      'Ujazaji, mzunguko, uratibu wa walinzi, na uendeshaji wa kila siku wa mali.',
    icon: 'Building2',
    conceptCategory: 'operations',
    topicSeed:
      'portfolio operations occupancy turnover caretaker estate running coordination',
  },
  {
    id: 'investment_strategy',
    labelEn: 'Investment & strategy',
    labelSw: 'Uwekezaji na mkakati',
    descriptionEn:
      'NOI, cap rates, yields, DSCR, and the numbers behind growing a portfolio.',
    descriptionSw:
      'NOI, cap rate, faida, DSCR, na namba za kukuza kundi la mali.',
    icon: 'TrendingUp',
    conceptCategory: 'strategy',
    topicSeed:
      'investment strategy NOI cap rate yield DSCR IRR valuation portfolio growth',
  },
];

const DOMAIN_BY_ID: ReadonlyMap<string, CourseDomain> = new Map(
  COURSE_DOMAINS.map((d) => [d.id, d]),
);

/** Resolve a domain by id, or `null` when unknown. */
export function findCourseDomain(id: string): CourseDomain | null {
  return DOMAIN_BY_ID.get(id) ?? null;
}

/** Human-readable label for a domain id in the chosen language. */
export function courseDomainLabel(id: string, language: 'en' | 'sw'): string {
  const domain = DOMAIN_BY_ID.get(id);
  if (!domain) return id;
  return language === 'sw' ? domain.labelSw : domain.labelEn;
}
