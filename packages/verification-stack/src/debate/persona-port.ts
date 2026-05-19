/**
 * Persona port — abstracts how a single persona produces a position.
 *
 * Two implementations:
 *   - LLM-backed persona: calls the LLM with the persona's system
 *     prompt + the action context + (round 2 only) the other personas'
 *     positions for rebuttal.
 *   - Heuristic persona: deterministic, used by tests. Reads the action
 *     fixture's annotated cues (e.g. "no statutory notice", "hardship request open")
 *     and emits a recommendation accordingly.
 */

import { extractText, type LlmClient } from '../ports/llm-client.js';
import type {
  DebatePersona,
  DebatePosition,
  DebateRecommendation,
} from '../types.js';
import { configFor } from './personas.js';

export interface PersonaInput {
  readonly round: number;
  readonly actionClass: string;
  readonly actionDescription: string;
  readonly context: Readonly<Record<string, unknown>>;
  /** In round 2, the round-1 positions from all personas. */
  readonly previousRound?: ReadonlyArray<DebatePosition>;
}

export interface PersonaPort {
  produce(persona: DebatePersona, input: PersonaInput): Promise<DebatePosition>;
}

export interface LlmPersonaArgs {
  readonly llm: LlmClient;
  readonly model?: string;
  readonly maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function llmPersona(args: LlmPersonaArgs): PersonaPort {
  const model = args.model ?? DEFAULT_MODEL;
  const maxTokens = args.maxTokens ?? 512;
  return {
    async produce(persona, input): Promise<DebatePosition> {
      const config = configFor(persona);
      const userPrompt = [
        `Round: ${input.round}`,
        `Action class: ${input.actionClass}`,
        `Action description: ${input.actionDescription}`,
        `Context: ${JSON.stringify(input.context)}`,
        ...(input.previousRound && input.previousRound.length > 0
          ? [
              '',
              'Round 1 positions to consider:',
              ...input.previousRound.map(
                (p) =>
                  `  - ${p.persona} → ${p.recommendation} (conf ${p.confidence.toFixed(2)}): ${p.position}`,
              ),
              '',
              input.round === 2
                ? 'Rebut the others where you disagree, and state your refined position.'
                : '',
            ]
          : []),
      ]
        .filter((l) => l !== '')
        .join('\n');
      try {
        const resp = await args.llm.messages.create({
          model,
          max_tokens: maxTokens,
          system: config.systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = extractText(resp);
        const parsed = parseJsonPosition(text);
        if (parsed) {
          return {
            persona,
            round: input.round,
            position: parsed.position,
            recommendation: parsed.recommendation,
            confidence: parsed.confidence,
          };
        }
      } catch {
        /* fallthrough */
      }
      // Fallback: default lean.
      return {
        persona,
        round: input.round,
        position: 'LLM call failed; using default lean.',
        recommendation: config.defaultLean,
        confidence: 0.3,
      };
    },
  };
}

/**
 * Heuristic persona — deterministic. Reads cues from `input.context`:
 *
 *   - "no_statutory_notice": true → Legal blocks, others modify/escalate
 *   - "hardship_request_open": true → Empathy blocks, others modify
 *   - "recovery_probability": number → Financial uses it
 *   - "operational_burden": "low"|"med"|"high" → PM weighs it
 *
 * Plus the round-2 rebuttal step: if a persona's round-1 confidence was
 * low and another persona's round-1 confidence was high, the lower one
 * defers to the higher in round 2.
 */
export function heuristicPersona(): PersonaPort {
  return {
    async produce(persona, input): Promise<DebatePosition> {
      const ctx = input.context;
      const noNotice = Boolean(ctx['no_statutory_notice']);
      const hardship = Boolean(ctx['hardship_request_open']);
      const recovery = typeof ctx['recovery_probability'] === 'number'
        ? (ctx['recovery_probability'] as number)
        : 0.5;
      const burden = String(ctx['operational_burden'] ?? 'med');

      let recommendation: DebateRecommendation;
      let confidence: number;
      let position: string;

      switch (persona) {
        case 'Legal':
          if (noNotice) {
            recommendation = 'block';
            confidence = 0.95;
            position = 'Statutory notice missing — proceeding creates wrongful-action risk.';
          } else {
            recommendation = 'proceed';
            confidence = 0.8;
            position = 'Statutory steps satisfied; the action is lawful.';
          }
          break;
        case 'Empathy':
          if (hardship) {
            recommendation = 'block';
            confidence = 0.9;
            position = 'Open hardship request — escalation premature; tenant must be heard first.';
          } else if (noNotice) {
            recommendation = 'modify';
            confidence = 0.75;
            position = 'No statutory notice = tenant had no chance to respond; modify to add cure period.';
          } else {
            recommendation = 'modify';
            confidence = 0.6;
            position = 'Offer a payment plan or mediation before escalation.';
          }
          break;
        case 'Financial':
          if (recovery >= 0.6) {
            recommendation = 'proceed';
            confidence = 0.85;
            position = `Recovery probability ${recovery.toFixed(2)} >= 0.6; proceed.`;
          } else if (recovery >= 0.4) {
            recommendation = 'modify';
            confidence = 0.7;
            position = `Recovery probability ${recovery.toFixed(2)} marginal; modify to lower-cost alternative.`;
          } else {
            recommendation = 'block';
            confidence = 0.7;
            position = `Recovery probability ${recovery.toFixed(2)} too low; legal cost exceeds expected recovery.`;
          }
          break;
        case 'PropertyManager':
          if (noNotice || hardship) {
            recommendation = 'escalate';
            confidence = 0.85;
            position = 'Conflicting signals from Legal/Empathy/Financial — escalate to human PM approver.';
          } else if (burden === 'high') {
            recommendation = 'modify';
            confidence = 0.7;
            position = 'Operational burden high; modify scope to reduce execution cost.';
          } else {
            recommendation = 'proceed';
            confidence = 0.75;
            position = 'Operationally feasible; no immediate red flags.';
          }
          break;
      }

      // Round 2 — adjust confidence based on rebuttal of round 1 positions.
      if (input.round === 2 && input.previousRound) {
        const others = input.previousRound.filter((p) => p.persona !== persona);
        const agreedCount = others.filter((p) => p.recommendation === recommendation).length;
        const disagreedCount = others.length - agreedCount;
        if (agreedCount >= 2) {
          confidence = Math.min(1, confidence + 0.05 * agreedCount);
        } else if (disagreedCount >= 2) {
          confidence = Math.max(0.3, confidence - 0.05 * disagreedCount);
        }
      }

      return {
        persona,
        round: input.round,
        position,
        recommendation,
        confidence,
      };
    },
  };
}

function parseJsonPosition(
  raw: string,
): { position: string; recommendation: DebateRecommendation; confidence: number } | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const pos = String(obj['position'] ?? '');
    const rec = String(obj['recommendation'] ?? 'escalate') as DebateRecommendation;
    const validRec: DebateRecommendation = (
      ['proceed', 'block', 'modify', 'escalate'] as const
    ).includes(rec)
      ? rec
      : 'escalate';
    const conf = Math.min(1, Math.max(0, Number(obj['confidence'] ?? 0.5)));
    return { position: pos, recommendation: validRec, confidence: conf };
  } catch {
    return null;
  }
}
