/**
 * parseBoardElements — BossNyumba blackboard parser (ported from Borjie).
 *
 * Strip `<board_add>{...}</board_add>` tags from the brain's reply,
 * validate each payload against the element zod union, and return the
 * body + validated elements.
 *
 * Defensive policy:
 *  - Caps at 12 elements per turn.
 *  - Drops any payload that fails the discriminated-union schema.
 *  - Strips the tag from the body either way (so the chat bubble
 *    never shows raw XML to the owner).
 *  - First-match wins on duplicate `id`s within one reply.
 */

import {
  boardElementSchema,
  type BoardElement,
} from './board-element-types.js';

const TAG_PATTERN = /<board_add>\s*(\{[\s\S]*?\})\s*<\/board_add>/gi;
const MAX_ELEMENTS_PER_TURN = 12;

export interface ParseBoardElementsResult {
  /** The body with all `<board_add>` tags removed. */
  readonly body: string;
  /** The validated elements in emission order. */
  readonly elements: ReadonlyArray<BoardElement>;
  /** Count of payloads that failed validation (for telemetry). */
  readonly dropped: number;
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseBoardElements(text: string): ParseBoardElementsResult {
  const elements: BoardElement[] = [];
  const seenIds = new Set<string>();
  let dropped = 0;

  const body = text.replace(TAG_PATTERN, (_match, json: string) => {
    if (elements.length >= MAX_ELEMENTS_PER_TURN) {
      dropped += 1;
      return '';
    }
    const parsed = safeParseJson(json);
    if (!parsed || typeof parsed !== 'object') {
      dropped += 1;
      return '';
    }
    const validated = boardElementSchema.safeParse(parsed);
    if (!validated.success) {
      dropped += 1;
      return '';
    }
    if (seenIds.has(validated.data.id)) {
      return '';
    }
    seenIds.add(validated.data.id);
    elements.push(validated.data);
    return '';
  });

  return { body, elements, dropped };
}
