/**
 * Reflexion critique generation (Shinn et al., 2023).
 *
 * After every multi-step task completion or failure, the MD runs a
 * self-critique pass:
 *
 *   What went wrong?
 *   What would I do differently?
 *   What general pattern does this teach me?
 *
 * The result is a `ReflectionNote` entity. Stored with embedding so that
 * next time the MD encounters a task with similar type, the top-3
 * matching reflections are retrieved and prepended to the system prompt.
 *
 * Maps to R3 #3 — Reflexion outer loop.
 */

import { randomUUID } from 'node:crypto';

import {
  ReflectionNoteSchema,
  type Embedding,
  type ReflectionNote,
  type TaskOutcome,
} from '../types.js';

export interface TaskRunContext {
  readonly taskType: string;
  readonly taskInput: string;
  readonly outcome: TaskOutcome;
  /** Free-text trace of what the agent did — actions, observations. */
  readonly trace: string;
  /** Optional terminal error message. */
  readonly error?: string;
}

/**
 * Canonical Reflexion critique prompt structure. We export it so callers
 * (kernel + tests) can render the same prompt the model sees.
 */
export const CRITIQUE_PROMPT_TEMPLATE = `\
You are reviewing your own performance on the task that just completed.
Be honest, specific, and brief. Do not flatter yourself.

Task type:
{taskType}

Task input:
{taskInput}

Outcome: {outcome}
Error: {error}

Execution trace:
{trace}

Answer in three short paragraphs, each labelled exactly:

[1] What went wrong (or what almost went wrong)?
[2] What would I do differently next time?
[3] What general lesson does this teach me about tasks of type "{taskType}"?

Be specific to the trace; cite at least one concrete step you took.
Avoid platitudes ("be more careful"). The lesson in [3] must be
re-usable across other tasks of the same type.
`;

/** Render the canonical critique prompt with the provided run context. */
export function renderCritiquePrompt(ctx: TaskRunContext): string {
  return CRITIQUE_PROMPT_TEMPLATE.replace('{taskType}', ctx.taskType)
    .replace('{taskInput}', ctx.taskInput)
    .replace('{outcome}', ctx.outcome)
    .replace('{error}', ctx.error ?? '(none)')
    .replace('{trace}', ctx.trace)
    .replace('{taskType}', ctx.taskType);
}

/**
 * Critique provider — calls an LLM and returns the parsed critique +
 * lesson. Injected so tests can supply a deterministic stub.
 */
export type CritiqueProvider = (
  prompt: string,
  ctx: TaskRunContext,
) => Promise<{ readonly critique: string; readonly lesson: string }> | {
  readonly critique: string;
  readonly lesson: string;
};

/** Embedder for indexing reflection notes by task type / input. */
export type Embedder = (
  text: string,
) => Promise<Embedding> | Embedding;

export interface BuildReflectionNoteOptions {
  readonly critiqueProvider: CritiqueProvider;
  readonly embedder: Embedder;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Build (but do not persist) a reflection note from the run context.
 * Uses the canonical critique prompt + the injected provider + embedder.
 */
export async function buildReflectionNote(
  options: BuildReflectionNoteOptions,
  ctx: TaskRunContext,
): Promise<ReflectionNote> {
  const prompt = renderCritiquePrompt(ctx);
  const { critique, lesson } = await options.critiqueProvider(prompt, ctx);
  if (!critique || critique.trim().length === 0) {
    throw new Error('Reflexion: critique provider returned empty critique');
  }
  if (!lesson || lesson.trim().length === 0) {
    throw new Error('Reflexion: critique provider returned empty lesson');
  }
  const embedSeed = `${ctx.taskType}\n${ctx.taskInput}\n${lesson}`;
  const embedding = await options.embedder(embedSeed);

  const note: ReflectionNote = {
    id: randomUUID(),
    taskType: ctx.taskType,
    taskInput: ctx.taskInput,
    outcome: ctx.outcome,
    critique: critique.trim(),
    lesson: lesson.trim(),
    embedding: Object.freeze([...embedding]),
    createdAt: nowIso(),
  };
  ReflectionNoteSchema.parse(note);
  return Object.freeze(note);
}
