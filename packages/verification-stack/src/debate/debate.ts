/**
 * Multi-Agent Debate orchestrator — 2 rounds, 4 personas.
 *
 * Round 1: each persona produces an independent position.
 * Round 2: each persona reads the other 3 positions and rebuts/refines.
 * Consensus extracted from round-2 recommendations.
 *
 * Closes L1 #11 and L3 #12.
 */

import type {
  ActionClass,
  DebatePersona,
  DebatePosition,
  DebateRecommendation,
  DebateResult,
  Verdict,
} from '../types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import type { PersonaPort } from './persona-port.js';

const DEFAULT_PERSONAS: ReadonlyArray<DebatePersona> = [
  'Legal',
  'Empathy',
  'Financial',
  'PropertyManager',
];

/** Actions that REQUIRE debate. */
export const DEBATE_REQUIRED_ACTIONS: ReadonlyArray<ActionClass> = Object.freeze([
  'eviction',
  'large-disbursement',
  'kra-filing',
  'lease-termination',
  'public-review',
]);

export function debateRequired(actionClass: ActionClass): boolean {
  return DEBATE_REQUIRED_ACTIONS.includes(actionClass);
}

export interface DebateDeps {
  readonly persona: PersonaPort;
  readonly clock?: Clock;
  /** Personas to include. Default: all 4. */
  readonly personas?: ReadonlyArray<DebatePersona>;
  /** Number of rounds. Default 2; spec says 2. */
  readonly rounds?: 2 | 3;
  /** Parallel positions inside a round. Default true. */
  readonly parallel?: boolean;
}

export interface DebateInput {
  readonly actionClass: string;
  readonly actionDescription: string;
  readonly context: Readonly<Record<string, unknown>>;
}

/**
 * Run a 2-round debate.
 */
export async function runDebate(
  input: DebateInput,
  deps: DebateDeps,
): Promise<DebateResult> {
  const clock = deps.clock ?? systemClock;
  const start = clock.monotonicMs();
  const personas = deps.personas ?? DEFAULT_PERSONAS;
  const rounds = deps.rounds ?? 2;
  const parallel = deps.parallel ?? true;

  const round1 = await runRound({
    personas,
    persona: deps.persona,
    input,
    round: 1,
    previousRound: undefined,
    parallel,
  });

  const allPositions: DebatePosition[] = [...round1];

  for (let r = 2; r <= rounds; r += 1) {
    const previous = allPositions.filter((p) => p.round === r - 1);
    const next = await runRound({
      personas,
      persona: deps.persona,
      input,
      round: r,
      previousRound: previous,
      parallel,
    });
    allPositions.push(...next);
  }

  const finalRound = allPositions.filter((p) => p.round === rounds);
  const { decision, recommendation, rationale } = extractConsensus(finalRound);

  const verdict: Verdict = recommendation === 'proceed'
    ? 'pass'
    : recommendation === 'block'
      ? 'fail'
      : recommendation === 'escalate'
        ? 'defer'
        : 'flag';

  return {
    decision,
    recommendation,
    positions: allPositions,
    rounds,
    verdict,
    elapsedMs: clock.monotonicMs() - start,
    rationale,
  };
}

interface RunRoundArgs {
  readonly personas: ReadonlyArray<DebatePersona>;
  readonly persona: PersonaPort;
  readonly input: DebateInput;
  readonly round: number;
  readonly previousRound: ReadonlyArray<DebatePosition> | undefined;
  readonly parallel: boolean;
}

async function runRound(args: RunRoundArgs): Promise<DebatePosition[]> {
  const buildInput = (p: DebatePersona) => ({
    round: args.round,
    actionClass: args.input.actionClass,
    actionDescription: args.input.actionDescription,
    context: args.input.context,
    ...(args.previousRound !== undefined ? { previousRound: args.previousRound } : {}),
  });

  if (args.parallel) {
    return Promise.all(args.personas.map((p) => args.persona.produce(p, buildInput(p))));
  }
  const out: DebatePosition[] = [];
  for (const p of args.personas) {
    out.push(await args.persona.produce(p, buildInput(p)));
  }
  return out;
}

interface Consensus {
  readonly decision: 'unanimous' | 'majority' | 'split' | 'no-consensus';
  readonly recommendation: DebateRecommendation;
  readonly rationale: string;
}

function extractConsensus(positions: ReadonlyArray<DebatePosition>): Consensus {
  if (positions.length === 0) {
    return {
      decision: 'no-consensus',
      recommendation: 'escalate',
      rationale: 'No positions produced.',
    };
  }
  const counts = new Map<DebateRecommendation, number>();
  const weightedCounts = new Map<DebateRecommendation, number>();
  for (const p of positions) {
    counts.set(p.recommendation, (counts.get(p.recommendation) ?? 0) + 1);
    weightedCounts.set(
      p.recommendation,
      (weightedCounts.get(p.recommendation) ?? 0) + p.confidence,
    );
  }

  const total = positions.length;
  let topRec: DebateRecommendation = 'escalate';
  let topCount = 0;
  for (const [rec, count] of counts) {
    if (count > topCount) {
      topRec = rec;
      topCount = count;
    } else if (count === topCount) {
      // Tie-break by confidence-weighted total.
      const a = weightedCounts.get(topRec) ?? 0;
      const b = weightedCounts.get(rec) ?? 0;
      if (b > a) topRec = rec;
    }
  }

  let decision: Consensus['decision'];
  if (topCount === total) decision = 'unanimous';
  else if (topCount >= Math.ceil(total / 2) + 1) decision = 'majority';
  else if (topCount === total / 2) decision = 'split';
  else decision = 'no-consensus';

  // No-consensus auto-escalates.
  if (decision === 'no-consensus' || decision === 'split') {
    return {
      decision,
      recommendation: 'escalate',
      rationale: `${decision} on top recommendation; escalating to human approver.`,
    };
  }

  return {
    decision,
    recommendation: topRec,
    rationale: `${decision} (${topCount}/${total}) on '${topRec}'.`,
  };
}
