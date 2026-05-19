/**
 * Built-in regex input shield for the Browser-Use fallback.
 *
 * Browser-Use has NO native prompt-injection defense (per L2 §3.1).
 * M-E will provide a full PI defense (vision-classifier + content
 * classifier); for the M-D milestone we ship a basic regex-based
 * shield that catches the most common injection patterns. Callers
 * who want richer defense supply a custom `InputShieldPort`.
 *
 * The shield runs over BOTH:
 *   - The task description before kicking off the browser run.
 *   - Any extracted text returned by the browser before it flows
 *     into the LLM's next step.
 */

import type { InputShieldPort, InputShieldVerdict } from '../ports/index.js';

/**
 * Patterns that indicate likely prompt-injection attempts. Each
 * pattern is paired with a short tag so callers + UI can surface
 * which specific class triggered.
 */
const INJECTION_PATTERNS: ReadonlyArray<{
  readonly tag: string;
  readonly pattern: RegExp;
}> = [
  // Direct override attempts
  { tag: 'ignore_prior', pattern: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instruction|prompt|message|rule)s?\b/iu },
  { tag: 'new_instructions', pattern: /\b(new|updated)\s+(instruction|prompt|task)s?\s*:/iu },
  // System impersonation
  { tag: 'system_role', pattern: /\b(you are now|act as|pretend (to be|you are))\b/iu },
  { tag: 'admin_claim', pattern: /\b(admin|superuser|root|developer)\s+(mode|access|override)\b/iu },
  // Exfiltration cues
  { tag: 'reveal_prompt', pattern: /\b(reveal|show|print|leak)\s+(your\s+)?(system\s+)?(prompt|instructions|rules)\b/iu },
  { tag: 'api_key', pattern: /\b(api[\s_-]?key|secret|token|password|credential)s?\b/iu },
  // Tool abuse
  { tag: 'browser_navigate', pattern: /\b(navigate|browse|visit|open)\s+to\s+https?:\/\//iu },
  { tag: 'download_exec', pattern: /\b(download|execute|run)\b[^.!?]{0,80}\b(script|file|payload|binary|exe)\b/iu },
  // Markdown image exfil (classic Browser-Use vector)
  { tag: 'markdown_img_exfil', pattern: /!\[.*?\]\(https?:\/\/[^)]*\?(.*?(prompt|key|token|cookie))/iu },
];

/**
 * Hard-block patterns — any match results in `blocked`, not just
 * `suspicious`. Reserved for the highest-risk indicators.
 */
const HARD_BLOCK_TAGS = new Set([
  'ignore_prior',
  'system_role',
  'admin_claim',
  'reveal_prompt',
  'markdown_img_exfil',
  'download_exec',
]);

/**
 * Run the built-in regex shield. `clean` if nothing matched,
 * `suspicious` if only soft patterns matched, `blocked` if any
 * hard pattern matched.
 */
export function createRegexInputShield(): InputShieldPort {
  return {
    scan: async (text: string): Promise<InputShieldVerdict> => {
      const matches: Array<{ readonly tag: string; readonly snippet: string }> = [];
      for (const { tag, pattern } of INJECTION_PATTERNS) {
        const result = pattern.exec(text);
        if (result !== null) {
          matches.push({ tag, snippet: result[0] });
        }
      }
      if (matches.length === 0) {
        return Object.freeze({ kind: 'clean' });
      }
      const hardHits = matches.filter((m) => HARD_BLOCK_TAGS.has(m.tag));
      if (hardHits.length > 0) {
        return Object.freeze({
          kind: 'blocked',
          matches: Object.freeze(hardHits.map((m) => m.tag)),
          reason: `Hard-block injection patterns detected: ${hardHits.map((m) => m.tag).join(', ')}`,
        });
      }
      return Object.freeze({
        kind: 'suspicious',
        matches: Object.freeze(matches.map((m) => m.tag)),
      });
    },
  };
}

/**
 * No-op shield — returns `clean` always. Used when callers explicitly
 * opt out of M-D's built-in defense (e.g. they've wired M-E).
 */
export function createNoopInputShield(): InputShieldPort {
  return {
    scan: async (): Promise<InputShieldVerdict> => Object.freeze({ kind: 'clean' }),
  };
}
