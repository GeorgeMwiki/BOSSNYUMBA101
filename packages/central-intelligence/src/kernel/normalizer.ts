/**
 * Normalizer — coerce sensor output into the kernel's expected shape.
 *
 * Three jobs:
 *
 *   1. Strip preamble — "Sure, here's the answer:" / "I'd be happy to"
 *      and similar throat-clearing.
 *   2. Repair JSON — when the sensor returned a JSON-block but added
 *      stray markdown fence or a trailing comma.
 *   3. Extract ui_block — sensors may emit a structured object inside
 *      ```ui_block``` fences for rendering. Pull it out and return
 *      it separately.
 *
 * Pure functions; deterministic.
 */

// Each regex must terminate at a colon — never a period — so the
// stripper cannot consume past the preamble into the actual answer.
const PREAMBLE_PATTERNS: ReadonlyArray<RegExp> = [
  /^(sure|certainly|absolutely|of course)[!.,]?\s+/i,
  /^here(?:'s| is) (?:the |your )?[^:\n.]{0,40}:\s*/i,
  /^i(?:'d| would) be (?:happy|glad) to[^:\n.]{0,40}:\s*/i,
  /^i can (?:help|assist)(?: you)?(?: with)?[^:\n.]{0,40}:\s*/i,
  /^let me [^:\n.]{0,40}:\s*/i,
  /^great question[!.,]?\s*/i,
];

export interface NormaliserOutput {
  readonly text: string;
  readonly uiBlock: unknown | null;
  readonly mutations: ReadonlyArray<string>;
}

export function normalize(raw: string): NormaliserOutput {
  let text = raw;
  const mutations: string[] = [];

  // Multiple preamble layers can nest ("Sure! Here's the answer: …").
  // Sweep until no more match.
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const re of PREAMBLE_PATTERNS) {
      if (re.test(text)) {
        text = text.replace(re, '');
        if (!mutations.includes('preamble-stripped')) {
          mutations.push('preamble-stripped');
        }
        stripped = true;
        break;
      }
    }
  }

  const ui = extractUiBlock(text);
  if (ui.found) {
    text = ui.remainder;
    mutations.push('ui_block-extracted');
  }

  text = repairFences(text, mutations);

  return { text: text.trimStart(), uiBlock: ui.value, mutations };
}

function extractUiBlock(text: string): { found: boolean; value: unknown | null; remainder: string } {
  const re = /```ui_block\s*\n([\s\S]*?)\n```/i;
  const m = text.match(re);
  if (!m) return { found: false, value: null, remainder: text };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    parsed = { raw: m[1] };
  }
  return { found: true, value: parsed, remainder: text.replace(re, '').trim() };
}

function repairFences(text: string, mutations: string[]): string {
  const jsonFenceRe = /```json\s*\n([\s\S]*?)\n```/g;
  return text.replace(jsonFenceRe, (_full, body: string) => {
    try {
      const parsed = JSON.parse(body);
      mutations.push('json-fence-validated');
      return '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
    } catch {
      const repaired = body.replace(/,(\s*[}\]])/g, '$1');
      try {
        const parsed = JSON.parse(repaired);
        mutations.push('json-fence-repaired');
        return '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
      } catch {
        mutations.push('json-fence-unrepairable');
        return '```\n' + body + '\n```';
      }
    }
  });
}
