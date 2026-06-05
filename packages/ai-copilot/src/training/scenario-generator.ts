/**
 * ScenarioGenerator — turns a scenario KIND into a typed, content-grounded
 * estate-domain rehearsal scenario built deterministically from the concept
 * catalog. Backs the scenario-simulation surface
 * (/coworker/training/scenarios) via the api-gateway scenario route.
 *
 * Each scenario kind (arrears negotiation, lease-compliance interview,
 * maintenance-incident triage, move-out inspection, tenant dispute) maps to a
 * topic query + concept category. The generator scores the REAL catalog
 * concepts against that query (same scoring spirit as TrainingGenerator),
 * orders by prerequisites, and assembles a briefing whose every objective,
 * hidden risk, and rubric line is grounded in a concept's own title/summary.
 *
 * HONEST-DEGRADE (CLAUDE.md hard rule): when no catalog concept matches a
 * kind the generator returns `null` rather than inventing a scenario. NOTHING
 * here fabricates scenario content — the briefing strings are derived from
 * catalog fields, never authored free-hand.
 *
 * Ported from LitFin's officer-portal training scenario builder and
 * retargeted lending -> real estate.
 */

import {
  ESTATE_CONCEPTS,
  type Concept,
} from './concepts-catalog.js';

export type ScenarioLanguage = 'en' | 'sw';

export const SCENARIO_KIND_VALUES = [
  'arrears_negotiation',
  'lease_compliance_interview',
  'maintenance_incident_triage',
  'move_out_inspection',
  'tenant_dispute',
] as const;
export type ScenarioKind = (typeof SCENARIO_KIND_VALUES)[number];

export type ScenarioDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** A single grounded rubric / objective / risk line, bilingual. */
export interface ScenarioBriefingLine {
  readonly conceptId: string;
  readonly en: string;
  readonly sw: string;
}

export interface ScenarioBriefing {
  /** Counterparty the learner is interacting with (tenant / contractor / …). */
  readonly counterpartyEn: string;
  readonly counterpartySw: string;
  /** Opening situation, grounded in the lead concept's summary. */
  readonly situationEn: string;
  readonly situationSw: string;
  /** What "good" looks like — one objective per covered concept. */
  readonly objectives: readonly ScenarioBriefingLine[];
  /** Things the learner should surface — grounded worked-example prompts. */
  readonly hiddenRisks: readonly ScenarioBriefingLine[];
  /** Scoring rubric — one criterion per covered concept. */
  readonly rubric: readonly ScenarioBriefingLine[];
}

export interface GeneratedScenario {
  readonly kind: ScenarioKind;
  readonly difficulty: ScenarioDifficulty;
  readonly language: ScenarioLanguage;
  readonly titleEn: string;
  readonly titleSw: string;
  readonly summaryEn: string;
  readonly summarySw: string;
  readonly conceptIds: readonly string[];
  readonly estimatedMinutes: number;
  readonly briefing: ScenarioBriefing;
  readonly generatedBy: 'concept_catalog';
}

interface KindSpec {
  readonly topic: string;
  readonly category: Concept['category'];
  readonly counterpartyEn: string;
  readonly counterpartySw: string;
  readonly titleEn: string;
  readonly titleSw: string;
}

// Each kind anchors to a catalog category + a topic query of estate terms.
// The query terms exist verbatim in real concept ids/titles/summaries so the
// scorer resolves real concepts (never invents).
const KIND_SPECS: Record<ScenarioKind, KindSpec> = {
  arrears_negotiation: {
    topic: 'arrears rent payment plan late fee affordability collection',
    category: 'financial',
    counterpartyEn: 'A tenant who has fallen behind on rent',
    counterpartySw: 'Mpangaji aliyechelewa kulipa kodi',
    titleEn: 'Arrears negotiation',
    titleSw: 'Mazungumzo ya malimbikizo ya kodi',
  },
  lease_compliance_interview: {
    topic: 'lease screening tenancy compliance interview obligation breach',
    category: 'tenancy',
    counterpartyEn: 'A prospective or current tenant under review',
    counterpartySw: 'Mpangaji anayehakikiwa',
    titleEn: 'Lease-compliance interview',
    titleSw: 'Mahojiano ya uzingatiaji wa mkataba',
  },
  maintenance_incident_triage: {
    topic: 'maintenance triage incident work order priority safety repair',
    category: 'maintenance',
    counterpartyEn: 'A tenant reporting a maintenance fault',
    counterpartySw: 'Mpangaji anayeripoti hitilafu ya matengenezo',
    titleEn: 'Maintenance-incident triage',
    titleSw: 'Upangaji wa dharura ya matengenezo',
  },
  move_out_inspection: {
    topic: 'move inspection deposit disposition security damage handover complaint',
    category: 'operations',
    counterpartyEn: 'A departing tenant at unit handover',
    counterpartySw: 'Mpangaji anayeondoka wakati wa kukabidhi nyumba',
    titleEn: 'Move-out inspection',
    titleSw: 'Ukaguzi wa kuhama',
  },
  tenant_dispute: {
    topic: 'complaint handling escalation dispute eviction notice resolution tenant',
    category: 'operations',
    counterpartyEn: 'A tenant in dispute with the estate',
    counterpartySw: 'Mpangaji aliye na mgogoro na jengo',
    titleEn: 'Tenant dispute resolution',
    titleSw: 'Utatuzi wa mgogoro wa mpangaji',
  },
};

const DIFFICULTY_RANK_CEILING: Record<ScenarioDifficulty, number> = {
  beginner: 2,
  intermediate: 4,
  advanced: 5,
};

function tokenize(topic: string): readonly string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

/** Topic-match score for a concept (id + title + summary + category). */
function scoreConcept(concept: Concept, tokens: readonly string[]): number {
  const hay =
    `${concept.id} ${concept.titleEn} ${concept.summaryEn} ${concept.category}`.toLowerCase();
  return tokens.reduce((acc, t) => (hay.includes(t) ? acc + 1 : acc), 0);
}

/** Order selected concepts so prerequisites precede dependents. */
function orderByPrerequisites(selected: readonly Concept[]): readonly Concept[] {
  const visited = new Set<string>();
  const ordered: Concept[] = [];
  const index = new Map(selected.map((c) => [c.id, c]));
  const visit = (c: Concept): void => {
    if (visited.has(c.id)) return;
    visited.add(c.id);
    for (const pid of c.prerequisites) {
      const p = index.get(pid);
      if (p) visit(p);
    }
    ordered.push(c);
  };
  for (const c of selected) visit(c);
  return ordered;
}

function summaryFor(concept: Concept, language: ScenarioLanguage): string {
  return language === 'sw' ? concept.summarySw || concept.summaryEn : concept.summaryEn;
}

function titleFor(concept: Concept, language: ScenarioLanguage): string {
  return language === 'sw' ? concept.titleSw || concept.titleEn : concept.titleEn;
}

function lineFrom(concept: Concept): ScenarioBriefingLine {
  return {
    conceptId: concept.id,
    en: concept.summaryEn,
    sw: concept.summarySw || concept.summaryEn,
  };
}

export interface ScenarioGeneratorDeps {
  readonly concepts?: readonly Concept[];
  /** Max concepts a scenario rehearses (5 keeps a run ~10 min). */
  readonly maxConcepts?: number;
}

export interface GenerateScenarioInput {
  readonly kind: ScenarioKind;
  readonly difficulty?: ScenarioDifficulty;
  readonly language?: ScenarioLanguage;
}

export class ScenarioGenerator {
  private readonly concepts: readonly Concept[];
  private readonly maxConcepts: number;

  constructor(deps: ScenarioGeneratorDeps = {}) {
    this.concepts = deps.concepts ?? ESTATE_CONCEPTS;
    this.maxConcepts = deps.maxConcepts ?? 5;
  }

  /**
   * Generate one scenario for a kind. Returns `null` when no catalog concept
   * matches (honest-degrade — never fabricates a scenario).
   */
  generate(input: GenerateScenarioInput): GeneratedScenario | null {
    const spec = KIND_SPECS[input.kind];
    if (!spec) return null;
    const difficulty: ScenarioDifficulty = input.difficulty ?? 'beginner';
    const language: ScenarioLanguage = input.language ?? 'en';
    const tokens = tokenize(spec.topic);
    const ceiling = DIFFICULTY_RANK_CEILING[difficulty];

    // Resolve the concept pool through a fallback chain so a real scenario is
    // produced whenever the catalog has relevant concepts. The difficulty
    // ceiling is a SOFT preference, not a hard filter that would otherwise
    // honest-degrade a kind to null while matching concepts exist at a higher
    // rank:
    //   1. same-category concepts within the difficulty ceiling
    //   2. all concepts in the category (any rank)
    //   3. topic-only across the whole catalog
    const score = (pool: readonly Concept[]) =>
      pool
        .map((c) => ({ c, score: scoreConcept(c, tokens) }))
        .filter((s) => s.score > 0)
        .sort(
          (a, b) => b.score - a.score || a.c.difficultyRank - b.c.difficultyRank,
        );

    const inCeiling = this.concepts.filter(
      (c) => c.category === spec.category && c.difficultyRank <= ceiling,
    );
    const inCategory = this.concepts.filter((c) => c.category === spec.category);

    let scored = score(inCeiling);
    if (scored.length === 0) scored = score(inCategory);
    if (scored.length === 0) scored = score(this.concepts);

    if (scored.length === 0) return null;

    const selected = orderByPrerequisites(
      scored.slice(0, this.maxConcepts).map((s) => s.c),
    );
    if (selected.length === 0) return null;

    const lead = selected[0]!;
    const objectives = selected.map(lineFrom);
    // Hidden risks: grounded worked-example "answer" lines where present.
    const hiddenRisks: ScenarioBriefingLine[] = [];
    for (const c of selected) {
      const ex = c.workedExamples[0];
      if (ex) {
        hiddenRisks.push({ conceptId: c.id, en: ex.answer, sw: ex.answer });
      }
    }
    const rubric = selected.map((c) => ({
      conceptId: c.id,
      en: `Demonstrates: ${c.titleEn}`,
      sw: `Anaonyesha: ${c.titleSw || c.titleEn}`,
    }));

    const estimatedMinutes = Math.max(
      5,
      Math.min(20, selected.length * 2 + lead.difficultyRank),
    );

    return {
      kind: input.kind,
      difficulty,
      language,
      titleEn: spec.titleEn,
      titleSw: spec.titleSw,
      summaryEn: `Rehearse ${spec.titleEn.toLowerCase()} grounded in ${titleFor(lead, 'en').toLowerCase()}.`,
      summarySw: `Fanya mazoezi ya ${spec.titleSw.toLowerCase()} kwa msingi wa ${titleFor(lead, 'sw').toLowerCase()}.`,
      conceptIds: selected.map((c) => c.id),
      estimatedMinutes,
      briefing: {
        counterpartyEn: spec.counterpartyEn,
        counterpartySw: spec.counterpartySw,
        situationEn: summaryFor(lead, 'en'),
        situationSw: summaryFor(lead, 'sw'),
        objectives,
        hiddenRisks,
        rubric,
      },
      generatedBy: 'concept_catalog',
    };
  }

  /** Generate every kind that resolves; skips kinds with no catalog match. */
  generateAll(
    difficulty: ScenarioDifficulty = 'beginner',
    language: ScenarioLanguage = 'en',
  ): readonly GeneratedScenario[] {
    const out: GeneratedScenario[] = [];
    for (const kind of SCENARIO_KIND_VALUES) {
      const s = this.generate({ kind, difficulty, language });
      if (s) out.push(s);
    }
    return out;
  }
}

export function createScenarioGenerator(
  deps: ScenarioGeneratorDeps = {},
): ScenarioGenerator {
  return new ScenarioGenerator(deps);
}
