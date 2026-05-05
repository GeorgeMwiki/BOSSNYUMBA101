/**
 * Self-awareness — measures whether the assistant stayed in persona.
 * Mirrors LITFIN's persona-drift detection (recent migration
 * 20260506_persona_drift). Pure heuristic, no LLM. Intended to be
 * fast (<1ms) and run on every turn.
 *
 * Drift signals:
 *
 *   - Taboo phrase appearance      — anything from persona.taboos
 *   - First-person form loss       — persona uses "I", reply uses
 *                                    "BossNyumba's AI" or "the system"
 *   - Tone violation               — empty hedges, marketing buzzwords
 *                                    in tenant scope
 *   - Likely fabrication           — assertions about tools/numbers
 *                                    when no tool call ran
 */

import type { PersonaIdentity } from './identity.js';
import type { GateVerdict, PersonaDriftEvent } from './kernel-types.js';

export interface SelfAwarenessInput {
  readonly persona: PersonaIdentity;
  readonly outputText: string;
  readonly toolCallCount: number;
  readonly hasCitations: boolean;
  readonly thoughtId: string;
  readonly capturedAt: string;
}

export interface SelfAwarenessOutput {
  readonly verdict: GateVerdict;
  readonly events: ReadonlyArray<PersonaDriftEvent>;
  readonly driftScore: number; // [0,1]; 0 = clean, 1 = severe drift
}

const FORBIDDEN_FIRST_PERSON_DODGES = [
  'as an ai',
  'as a language model',
  'as an artificial intelligence',
  'i am just a',
  'i\'m just a',
  'bossnyumba\'s ai',
  'the system',
  'this assistant',
];

const BUZZWORD_PATTERNS: ReadonlyArray<RegExp> = [
  /\bsynerg\w+/i,
  /\bleverage\b/i,
  /\bcutting[- ]edge\b/i,
  /\brevolutionary\b/i,
  /\bgame[- ]chang\w+/i,
];

const FABRICATION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(the data shows|the records show|the system says|i can see in the database)\b/i,
  /\b(based on (your|the) (records|data|history))\b/i,
];

export function checkSelfAwareness(input: SelfAwarenessInput): SelfAwarenessOutput {
  const lower = input.outputText.toLowerCase();
  const events: PersonaDriftEvent[] = [];

  for (const signal of input.persona.violationSignals) {
    if (lower.includes(signal.toLowerCase())) {
      events.push(makeEvent(input, 'taboo', signal, 'high'));
    }
  }

  for (const dodge of FORBIDDEN_FIRST_PERSON_DODGES) {
    if (lower.includes(dodge)) {
      events.push(makeEvent(input, 'first-person-loss', dodge, 'medium'));
      break;
    }
  }

  for (const re of BUZZWORD_PATTERNS) {
    const m = re.exec(input.outputText);
    if (m) {
      events.push(makeEvent(input, 'tone', m[0], 'low'));
      break;
    }
  }

  if (input.toolCallCount === 0 && !input.hasCitations) {
    for (const re of FABRICATION_PATTERNS) {
      const m = re.exec(input.outputText);
      if (m) {
        events.push(makeEvent(input, 'fabrication', m[0], 'high'));
        break;
      }
    }
  }

  const sevWeights: Record<PersonaDriftEvent['severity'], number> = {
    low: 0.15,
    medium: 0.4,
    high: 0.85,
  };
  const driftScore = Math.min(
    1,
    events.reduce((acc, e) => acc + sevWeights[e.severity], 0),
  );

  let verdict: GateVerdict;
  if (driftScore >= 0.85) {
    verdict = { status: 'block', reason: 'severe persona drift' };
  } else if (driftScore >= 0.4) {
    verdict = { status: 'soften', reason: 'persona drift detected; voice corrected' };
  } else {
    verdict = { status: 'pass' };
  }

  return { verdict, events, driftScore };
}

function makeEvent(
  input: SelfAwarenessInput,
  violationType: PersonaDriftEvent['violationType'],
  excerpt: string,
  severity: PersonaDriftEvent['severity'],
): PersonaDriftEvent {
  return {
    thoughtId: input.thoughtId,
    personaId: input.persona.id,
    violationType,
    excerpt,
    severity,
    detectedAt: input.capturedAt,
  };
}
