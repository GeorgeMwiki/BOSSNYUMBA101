/**
 * Auto-mode classifier prompt structure.
 *
 * Three sections compose the prompt:
 *
 *   1. ROLE        — short fixed string scoping the classifier to the
 *                    safe/borderline/unsafe verdict.
 *   2. CONTEXT     — recent conversation turns + stated boundaries.
 *   3. ACTION      — the tool the agent wants to call + args + tier.
 *
 * The classifier returns a JSON object matching `ClassifierVerdict`.
 * The caller is responsible for parsing + validating (zod) before
 * trusting it.
 */

import type { ClassifierInput } from './types.js';

export const CLASSIFIER_SYSTEM_PROMPT = `You are a safety classifier for an autonomous property-management agent.
Your job is to label a proposed tool call as ONE of:
  - "safe"       — explicitly within stated boundaries; reversible or low blast radius.
  - "borderline" — could go either way; needs owner sign-off this turn.
  - "unsafe"     — likely violates a stated boundary or has high blast radius
                   (mass-comm, money movement, destructive write) AND no
                   prior consent signal exists in conversation.

Return EXACTLY one JSON object on the schema:
  {
    "verdict": "safe" | "borderline" | "unsafe",
    "reason":  "one sentence, plain English",
    "recommendPlanMode": boolean
  }
No prose, no markdown fences.`;

/**
 * Build the user-turn prompt body. Pure function — no I/O.
 *
 * Stays under ~2 KB on realistic inputs so the Haiku call is cheap.
 */
export function buildClassifierPrompt(input: ClassifierInput): string {
  const turns =
    input.recentTurns.length === 0
      ? '(no prior turns)'
      : input.recentTurns
          .slice(-8) // bound the window
          .map((t, i) => `  [${i + 1}] ${truncate(t, 400)}`)
          .join('\n');

  const boundaries =
    input.statedBoundaries.length === 0
      ? '(none)'
      : input.statedBoundaries.map((b) => `  - ${truncate(b, 200)}`).join('\n');

  const argsBlob = stableJson(input.args);

  return [
    `Tool: ${input.toolName}`,
    `Tier: ${input.tier}`,
    `Args:`,
    `\`\`\`json\n${truncate(argsBlob, 1500)}\n\`\`\``,
    `Recent conversation (latest last):`,
    turns,
    `Stated boundaries (treat as deny-signals):`,
    boundaries,
    `Return your JSON verdict now.`,
  ].join('\n');
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value, sortedKeysReplacer(), 2);
  } catch {
    return '"<unserializable>"';
  }
}

function sortedKeysReplacer(): (k: string, v: unknown) => unknown {
  return (_key, value) => {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(obj).sort()) out[k] = obj[k];
      return out;
    }
    return value;
  };
}
