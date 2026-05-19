/**
 * ReflectionSynth — Generative-Agents (Park et al., 2023) periodic
 * background reflection synthesizer.
 *
 * Condenses recent core-memory blocks + KG nodes for a given subject
 * (tenant, building, vendor, portfolio, platform) over a period into a
 * higher-order natural-language insight stored as a `reflection`
 * entity in the J1 store (see `J1ReflectionStore` adapter type below).
 *
 * The synthesizer is LLM-callable but here we accept a pluggable
 * `Synthesizer` function so tests can inject a deterministic stub.
 *
 * Maps to R3 #2 — three-tier memory, reflection layer.
 *
 * Default cadence: daily (`24h`). Caller schedules via cron / J1 jobs.
 */

import { randomUUID } from 'node:crypto';

import {
  ReflectionSynthesisSchema,
  type IsoTimestamp,
  type KGEdge,
  type ReflectionSynthesis,
} from '../types.js';
import type { CoreBlock } from '../types.js';

export interface SynthesisInput {
  readonly subjectType: ReflectionSynthesis['subjectType'];
  readonly subjectId: string;
  readonly periodStart: IsoTimestamp;
  readonly periodEnd: IsoTimestamp;
  readonly coreBlocks: readonly CoreBlock[];
  readonly recentFacts: readonly KGEdge[];
}

export interface SynthesizerResult {
  readonly summary: string;
  readonly importance: number;
}

export type Synthesizer = (
  input: SynthesisInput,
) => Promise<SynthesizerResult> | SynthesizerResult;

/**
 * Adapter to the J1 reflection-entity store. We keep this as an interface
 * so the brain-quality package stays a pure library — the application
 * layer wires the real J1 store implementation.
 */
export interface J1ReflectionStore {
  put(reflection: ReflectionSynthesis): Promise<void> | void;
  listForSubject(
    subjectType: ReflectionSynthesis['subjectType'],
    subjectId: string,
  ): Promise<readonly ReflectionSynthesis[]> | readonly ReflectionSynthesis[];
}

export interface ReflectionSynthOptions {
  readonly synthesizer: Synthesizer;
  readonly store: J1ReflectionStore;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) {
    return 0;
  }
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Run one reflection-synthesis pass. Persists the result to J1 and returns
 * the produced reflection. Throws if synthesizer returns empty summary.
 */
export async function synthesizeReflection(
  options: ReflectionSynthOptions,
  input: SynthesisInput,
): Promise<ReflectionSynthesis> {
  if (input.coreBlocks.length === 0 && input.recentFacts.length === 0) {
    throw new Error(
      'ReflectionSynth: empty input — refusing to synthesize from nothing',
    );
  }

  const result = await options.synthesizer(input);
  if (!result.summary || result.summary.trim().length === 0) {
    throw new Error('ReflectionSynth: synthesizer returned empty summary');
  }

  const reflection: ReflectionSynthesis = {
    id: randomUUID(),
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    summary: result.summary.trim(),
    evidenceIds: Object.freeze([
      ...input.coreBlocks.map((b) => `core:${b.id}`),
      ...input.recentFacts.map((f) => `fact:${f.id}`),
    ]),
    importance: clamp01(result.importance),
    createdAt: nowIso(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  };

  ReflectionSynthesisSchema.parse(reflection);
  await options.store.put(reflection);
  return reflection;
}

/**
 * Default cadence helper. Returns true iff `now - lastRunAt >= 24h`.
 * Use to gate cron-driven background jobs.
 */
export function isDueForSynthesis(
  lastRunAt: IsoTimestamp | null,
  nowAt: IsoTimestamp = nowIso(),
  intervalHours: number = 24,
): boolean {
  if (!lastRunAt) {
    return true;
  }
  const lastMs = Date.parse(lastRunAt);
  const nowMs = Date.parse(nowAt);
  if (Number.isNaN(lastMs) || Number.isNaN(nowMs)) {
    return true;
  }
  const elapsed = nowMs - lastMs;
  return elapsed >= intervalHours * 60 * 60 * 1000;
}

/**
 * Default heuristic synthesizer — extracts a one-line summary by
 * counting recurring properties in the recent facts. Used in tests and
 * as a graceful fallback when no LLM client is configured.
 */
export const heuristicSynthesizer: Synthesizer = (input) => {
  const factCount = input.recentFacts.length;
  const coreCount = input.coreBlocks.length;
  const predicates = new Set(input.recentFacts.map((f) => f.predicate));

  const summary =
    `Subject ${input.subjectType}:${input.subjectId} — observed ${factCount} ` +
    `fact${factCount === 1 ? '' : 's'} across ${predicates.size} predicate` +
    `${predicates.size === 1 ? '' : 's'} (${[...predicates].join(', ')}) ` +
    `plus ${coreCount} core-memory note${coreCount === 1 ? '' : 's'} during ` +
    `period ${input.periodStart} → ${input.periodEnd}.`;

  // Importance scales with novelty: more distinct predicates ⇒ higher.
  const importance = Math.min(1, predicates.size / 5);
  return { summary, importance };
};
