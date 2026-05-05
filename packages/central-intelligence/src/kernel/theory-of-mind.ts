/**
 * Theory of mind — observed user mental state.
 *
 * The kernel infers, from the user's message alone, what the user
 * already knows, what they're trying to decide, and how impatient
 * they are. This biases how the assistant frames the answer:
 *
 *   - urgency='high'      → lead with the action, defer rationale
 *   - expertise='novice'  → define jargon on first use
 *   - decision-mode       → produce a recommendation, not a survey
 *
 * Pure heuristic over the message text and recent thread history.
 */

export type Urgency = 'low' | 'medium' | 'high';
export type Expertise = 'novice' | 'intermediate' | 'expert';
export type Mode = 'browse' | 'decide' | 'execute' | 'learn';

export interface MindState {
  readonly urgency: Urgency;
  readonly expertise: Expertise;
  readonly mode: Mode;
  readonly emotionalCharge: number;     // [-1,1]; negative = frustrated
}

const URGENCY_HIGH = [
  /\b(now|right now|immediately|asap|today|urgent|emergency)\b/i,
  /!{2,}/,
];
const URGENCY_LOW = [
  /\b(when you have a moment|no rush|whenever|at some point)\b/i,
];

const EXPERTISE_NOVICE_PHRASES = [
  /\bwhat is (a|an|the)\b/i,
  /\bhow do i\b/i,
  /\bcan you explain\b/i,
  /\bi don'?t understand\b/i,
];
const EXPERTISE_EXPERT_TOKENS = [
  /\bdscr\b/i,
  /\bcap rate\b/i,
  /\barrears ladder\b/i,
  /\bk-anonym\w+/i,
  /\btgn\b/i,
  /\bconformal\b/i,
];

const MODE_DECIDE = [
  /\bshould i\b/i,
  /\bwhich one\b/i,
  /\bbetter\b/i,
  /\brecommend\w*/i,
];
const MODE_EXECUTE = [
  /\b(do it|go ahead|proceed|run|trigger|start|begin|book|file|send)\b/i,
];
const MODE_LEARN = [
  /\b(teach me|walk me through|how does .* work|explain)\b/i,
];

const NEG_EMO = [
  /\b(angry|furious|frustrated|annoyed|upset|fed up|sick of)\b/i,
  /!{3,}/,
];
const POS_EMO = [
  /\b(thanks|thank you|appreciate|love|great|excellent|perfect)\b/i,
];

export function inferMindState(message: string): MindState {
  return {
    urgency:        scoreUrgency(message),
    expertise:      scoreExpertise(message),
    mode:           scoreMode(message),
    emotionalCharge: scoreEmotion(message),
  };
}

function scoreUrgency(m: string): Urgency {
  if (URGENCY_HIGH.some((re) => re.test(m))) return 'high';
  if (URGENCY_LOW.some((re) => re.test(m))) return 'low';
  return 'medium';
}

function scoreExpertise(m: string): Expertise {
  const novice = EXPERTISE_NOVICE_PHRASES.some((re) => re.test(m));
  const expert = EXPERTISE_EXPERT_TOKENS.some((re) => re.test(m));
  // Domain shorthand wins: a novice would not say "cap rate" or "DSCR",
  // even if the sentence uses a "what is …" framing.
  if (expert) return 'expert';
  if (novice) return 'novice';
  return 'intermediate';
}

function scoreMode(m: string): Mode {
  if (MODE_EXECUTE.some((re) => re.test(m))) return 'execute';
  if (MODE_DECIDE.some((re) => re.test(m))) return 'decide';
  if (MODE_LEARN.some((re) => re.test(m))) return 'learn';
  return 'browse';
}

function scoreEmotion(m: string): number {
  let score = 0;
  if (NEG_EMO.some((re) => re.test(m))) score -= 0.6;
  if (POS_EMO.some((re) => re.test(m))) score += 0.5;
  return Math.max(-1, Math.min(1, score));
}

/**
 * Render a one-line behavioural directive for the system prompt that
 * tells the sensor how to frame the answer for this mind state.
 */
export function renderMindStateDirective(s: MindState): string {
  const parts: string[] = [];
  if (s.urgency === 'high') parts.push('Lead with the action; rationale follows in one short sentence.');
  if (s.urgency === 'low')  parts.push('You may take a measured tone; the user is not in a rush.');
  if (s.expertise === 'novice') parts.push('Define any jargon on first use; offer an example before the rule.');
  if (s.expertise === 'expert') parts.push('You may use domain shorthand without expansion.');
  if (s.mode === 'decide')  parts.push('End with a single recommendation, not a list of options.');
  if (s.mode === 'execute') parts.push('Confirm what will be done, then either do it or hand off to the workflow.');
  if (s.mode === 'learn')   parts.push('Teach by example before stating the rule. Check understanding mid-way.');
  if (s.emotionalCharge < -0.3) parts.push('The user is frustrated. Acknowledge that briefly, then move to action.');
  return parts.length > 0 ? parts.join(' ') : 'Answer at conversational pace.';
}
