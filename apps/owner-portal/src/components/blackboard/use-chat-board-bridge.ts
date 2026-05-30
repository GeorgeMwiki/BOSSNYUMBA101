/**
 * use-chat-board-bridge — wire SSE chat stream → blackboard store.
 *
 * Listens to the streaming assistant text and, whenever a complete
 * `<board_add>{...}</board_add>` tag appears, validates the payload
 * via the shared zod schema and calls `appendBoardElement`. Already
 * seen tag-ids are tracked so each element is only pushed once even
 * though `assistantText` grows on every SSE delta.
 *
 * This is the BossNyumba parity layer for Borjie's
 * `apps/owner-web/.../HomeChatTeach.tsx` SSE `board_element` handler.
 * Borjie has the api-gateway re-emit a dedicated `board_element`
 * event; BN parses the same tags client-side so no server change is
 * needed to enable the chat ↔ board hook.
 *
 * Lifecycle:
 *  - The hook is bound to a single `messageId` so reused state never
 *    leaks across turns.
 *  - `reset()` is called via the cleanup or when `messageId` changes
 *    so a brand-new turn starts with a fresh seen-set.
 */

import { useEffect, useRef } from 'react';
import {
  parseBoardElements,
  type BoardElement,
} from '@bossnyumba/chat-ui';
import { appendBoardElement } from './use-blackboard-store';

// Cheap presence check — the heavy parse only fires when this
// matches. Non-global (no `lastIndex` state) so multiple calls don't
// stride past each other.
const TAG_PRESENT_PATTERN = /<board_add>[\s\S]*?<\/board_add>/i;

interface UseChatBoardBridgeOptions {
  /** Live assistant text — grows on every SSE delta. */
  readonly assistantText: string;
  /** The chat message id the elements should be attributed to. */
  readonly messageId: string | null;
  /** True while the chat is still streaming. */
  readonly isStreaming: boolean;
}

/**
 * Bind the assistant text to the blackboard store. Returns nothing —
 * the hook drives the module-level store directly so the sibling
 * `<Blackboard />` aside re-renders without any prop drilling.
 */
export function useChatBoardBridge({
  assistantText,
  messageId,
}: UseChatBoardBridgeOptions): void {
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastMessageIdRef = useRef<string | null>(null);

  // Reset the seen-set whenever a new turn starts so id collisions
  // between consecutive turns don't silently swallow the second
  // turn's elements.
  if (messageId && messageId !== lastMessageIdRef.current) {
    seenIdsRef.current = new Set();
    lastMessageIdRef.current = messageId;
  }

  useEffect(() => {
    if (!messageId) return;
    if (!TAG_PRESENT_PATTERN.test(assistantText)) return;
    // `parseBoardElements` strips tags + validates each payload — but
    // for the streaming case we only want the new elements (anything
    // we have already pushed must not be re-emitted). We rely on the
    // local seen-set rather than the store's de-dupe so we don't
    // re-trigger the store reducer for every keystroke worth of
    // delta on a partial tag.
    const result = parseBoardElements(assistantText);
    for (const element of result.elements as ReadonlyArray<BoardElement>) {
      if (seenIdsRef.current.has(element.id)) continue;
      seenIdsRef.current.add(element.id);
      appendBoardElement(element, messageId);
    }
  }, [assistantText, messageId]);
}
