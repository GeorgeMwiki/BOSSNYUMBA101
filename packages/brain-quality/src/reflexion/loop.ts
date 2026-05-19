/**
 * Reflexion outer loop wiring.
 *
 * Two callable surfaces:
 *
 *   completeAndReflect()  — run after every multi-step task; produces +
 *                           persists a reflection note.
 *   retrieveForTask()     — call before starting a similar task; returns
 *                           top-N reflections to inject in system prompt.
 *
 * "Free RL signal" — no fine-tuning, just retrieval-augmented continuous
 * improvement (R3 #3).
 */

import type { Embedding, ReflectionNote } from '../types.js';
import {
  buildReflectionNote,
  type BuildReflectionNoteOptions,
  type Embedder,
  type TaskRunContext,
} from './critique.js';
import type { ReflectionStore } from './store.js';

export interface ReflexionLoopOptions extends BuildReflectionNoteOptions {
  readonly store: ReflectionStore;
}

/**
 * Build + persist a reflection note from a task run. Returns the note so
 * callers can immediately surface it in the trace.
 */
export async function completeAndReflect(
  options: ReflexionLoopOptions,
  ctx: TaskRunContext,
): Promise<ReflectionNote> {
  const note = await buildReflectionNote(options, ctx);
  await options.store.put(note);
  return note;
}

export interface RetrieveOptions {
  readonly store: ReflectionStore;
  readonly embedder: Embedder;
  /** Default 3 — matches the audit's "top-3 reflections" requirement. */
  readonly topK?: number;
  readonly taskType?: string;
}

export interface RetrieveResult {
  readonly notes: readonly ReflectionNote[];
  readonly queryEmbedding: Embedding;
}

/**
 * Retrieve top-k cosine-similar reflection notes for a candidate task.
 * Use the result to prepend a "lessons from prior attempts" section to
 * the system prompt before kicking off a new run.
 */
export async function retrieveForTask(
  options: RetrieveOptions,
  candidate: { readonly taskType: string; readonly taskInput: string },
): Promise<RetrieveResult> {
  const k = options.topK ?? 3;
  const embedSeed = `${candidate.taskType}\n${candidate.taskInput}`;
  const embedding = await options.embedder(embedSeed);
  const filter = options.taskType
    ? { taskType: options.taskType }
    : { taskType: candidate.taskType };
  const notes = await options.store.topK(embedding, k, filter);
  return Object.freeze({
    notes,
    queryEmbedding: Object.freeze([...embedding]),
  });
}

/**
 * Render top-K reflection lessons as a compact system-prompt section.
 * Each lesson is a single bullet — caller prepends to the prompt.
 */
export function renderReflectionLessons(
  notes: readonly ReflectionNote[],
): string {
  if (notes.length === 0) {
    return '';
  }
  const bullets = notes
    .map((n, i) => `${i + 1}. (${n.outcome}) ${n.lesson}`)
    .join('\n');
  return `# Lessons from prior attempts at similar tasks\n${bullets}\n`;
}
