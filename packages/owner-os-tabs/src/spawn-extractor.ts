/**
 * `<spawn_tabs>` extractor — runs server-side inside the BN chat router.
 *
 * BossNyumba real-estate edition (ported from Borjie's @borjie/owner-os-tabs).
 *
 * The owner-advisor system prompt instructs Mr. Mwikila to emit a single
 * `<spawn_tabs>` block per reply that touches an actionable real-estate
 * domain:
 *
 *   <spawn_tabs>{ "tabs": [
 *     { "type": "maintenance",
 *       "context": { "focus": "Mwenge T-23 plumbing" },
 *       "reason": "3 open tickets, oldest 4 days" }
 *   ] }</spawn_tabs>
 *
 * The FE picks up this payload as an SSE event and renders a small
 * "Suggested tab" chip below the assistant bubble. Clicking the chip
 * spawns / augments the matching tab via `useOwnerTabs.spawnOrAugment(...)`.
 *
 * This parser is deliberately defensive — the model occasionally forgets
 * the wrapping object, hallucinates an unknown tab type, or emits more
 * than 3 candidates. Every issue is corrected here so the FE always
 * receives a clean, capped, validated batch.
 */

import {
  ownerOsSpawnBatchSchema,
  type OwnerOSSpawnBatch,
  type OwnerOSSpawnIntent,
} from './types.js';

const SPAWN_TAG_PATTERN = /<spawn_tabs>\s*(\{[\s\S]*?\})\s*<\/spawn_tabs>/i;

export interface ExtractSpawnResult {
  /** The model text with the `<spawn_tabs>` tag removed. */
  readonly body: string;
  /** The parsed, validated batch (empty array when none found). */
  readonly batch: OwnerOSSpawnBatch;
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Strip + parse the first `<spawn_tabs>` tag from the model output.
 * Returns the cleaned body and the validated batch.
 *
 * Validation policy:
 *   - Caps the batch at 3 candidates (system-prompt rule).
 *   - Drops any candidate whose `type` is not in the registry union.
 *   - Drops any candidate whose `reason` is missing / over 160 chars.
 *   - Drops any candidate whose `context` fails the shared schema.
 *
 * If the model emits multiple `<spawn_tabs>` tags, only the first is
 * honoured (the second is stripped silently).
 *
 * Never throws.
 */
export function extractSpawnTabs(text: string): ExtractSpawnResult {
  let batch: OwnerOSSpawnBatch = { tabs: [] };
  let body = text;

  body = body.replace(SPAWN_TAG_PATTERN, (_m, json: string) => {
    const parsed = safeParseJson(json);
    if (!parsed || typeof parsed !== 'object') return '';
    const candidate = ownerOsSpawnBatchSchema.safeParse(parsed);
    if (candidate.success) {
      batch = candidate.data;
    } else {
      // Salvage individual entries — the model occasionally emits an
      // extra unknown key per item that fails the strict parse. Re-parse
      // each entry independently and keep only the valid ones.
      const tabsArr = (parsed as { tabs?: unknown }).tabs;
      if (Array.isArray(tabsArr)) {
        const salvaged: OwnerOSSpawnIntent[] = [];
        for (const raw of tabsArr.slice(0, 3)) {
          const oneParsed =
            ownerOsSpawnBatchSchema.shape.tabs.element.safeParse(raw);
          if (oneParsed.success) salvaged.push(oneParsed.data);
        }
        batch = { tabs: salvaged };
      }
    }
    return '';
  });

  // Strip any orphan opening / closing tag the brain may have left.
  body = body.replace(/<\/?spawn_tabs>/gi, '');

  return { body, batch };
}
