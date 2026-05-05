/**
 * Cognitive load — does the user appear overloaded? If so, throttle
 * the answer's depth and break it into smaller chunks. The kernel
 * uses this to decide:
 *
 *   - max number of citations rendered inline (high load → 2; low → 8)
 *   - whether to emit an artifact alongside text (high load → no)
 *   - max sentence count of the reply
 *
 * Signals: question length, multi-question density, recent
 * back-and-forth volume, mid-message hedging (hesitation markers).
 */

import type { GateVerdict } from './kernel-types.js';

export interface CognitiveLoadInput {
  readonly userMessage: string;
  readonly recentTurnCount: number; // turns by user in last 5 minutes
}

export interface CognitiveLoadOutput {
  readonly load: 'low' | 'medium' | 'high';
  readonly verdict: GateVerdict;
  readonly maxSentences: number;
  readonly maxCitations: number;
  readonly allowArtifact: boolean;
}

const HESITATION_MARKERS = [
  /\b(uh|um|er|hmm|actually|wait|sorry)\b/i,
  /\.{3,}/,
];

export function assessCognitiveLoad(input: CognitiveLoadInput): CognitiveLoadOutput {
  const m = input.userMessage;
  const wordCount = m.trim().split(/\s+/).filter(Boolean).length;
  const questionCount = (m.match(/\?/g) ?? []).length;
  const hesitationHits = HESITATION_MARKERS.filter((re) => re.test(m)).length;

  let score = 0;
  if (wordCount > 80) score += 1;
  if (questionCount >= 3) score += 1;
  if (hesitationHits >= 2) score += 1;
  if (input.recentTurnCount >= 6) score += 1;

  const load: 'low' | 'medium' | 'high' =
    score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';

  const verdict: GateVerdict =
    load === 'high'
      ? { status: 'soften', reason: 'cognitive overload — reply throttled' }
      : { status: 'pass' };

  return {
    load,
    verdict,
    maxSentences: load === 'high' ? 3 : load === 'medium' ? 6 : 12,
    maxCitations: load === 'high' ? 2 : load === 'medium' ? 5 : 8,
    allowArtifact: load !== 'high',
  };
}

export function renderLoadDirective(out: CognitiveLoadOutput): string {
  return `Reply in at most ${out.maxSentences} sentences, with at most ${out.maxCitations} inline citations.${
    out.allowArtifact ? '' : ' Do not produce an artifact this turn.'
  }`;
}
