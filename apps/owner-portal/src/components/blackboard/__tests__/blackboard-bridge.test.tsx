/**
 * Blackboard ↔ learning-chat bridge — BossNyumba behaviour test.
 *
 * Mr. Mwikila streams `<board_add>{...}</board_add>` tags inline in
 * the chat body. `useChatBoardBridge` listens to the streaming
 * `assistantText`, validates each payload via the shared zod schema,
 * and calls `appendBoardElement`. The mounted `Blackboard` aside
 * subscribes to the module-level store and re-renders.
 *
 * This test exercises the FE bridge end-to-end:
 *  1. Render Blackboard — empty state.
 *  2. Drive the bridge hook with a streamed assistant text that
 *     contains a `<board_add>` tag.
 *  3. Assert the Blackboard re-renders with the element AND the
 *     empty state disappears.
 *  4. Re-emit the same tag (parity with SSE re-delivery) — store
 *     dedupes by id.
 *
 * This is the BossNyumba blackboard ↔ chat bridge test.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { Blackboard } from '../Blackboard';
import { clearBoard, getBoardState } from '../use-blackboard-store';
import { useChatBoardBridge } from '../use-chat-board-bridge';

// Reset the module-level store between cases so element accumulation
// from one test never leaks into the next.
afterEach(() => {
  clearBoard();
  cleanup();
});

const RENT_YIELD_FORMULA_TAG = `Let me walk you through how a residential lease is structured. <board_add>{"type":"formula","id":"f-yield","latex":"rent_yield = annual_income ÷ market_value × 100","label":{"en":"Rent yield formula","sw":"Fomula ya mavuno ya kodi"},"variables":[{"symbol":"annual_income","meaning":{"en":"Net rent collected over 12 months","sw":"Kodi halisi kwa miezi 12"}}]}</board_add> The yield reads as a percentage.`;

const PORTFOLIO_DIAGRAM_TAG = `<board_add>{"type":"diagram","id":"d-lease-flow","kind":"flow","nodes":[{"id":"draft","label":{"en":"DRAFT","sw":"RASIMU"}},{"id":"sign","label":{"en":"SIGN","sw":"SAINI"}},{"id":"deposit","label":{"en":"DEPOSIT","sw":"AMANA"}},{"id":"handover","label":{"en":"HANDOVER","sw":"KABIDHI"}}]}</board_add>`;

describe('Blackboard ↔ learning-chat bridge (BossNyumba)', () => {
  it('renders the empty state until the chat emits a board element', () => {
    render(<Blackboard languagePreference="en" tradingName="Acacia Estates" />);
    expect(
      screen.getByText(/Ask about leases, rent escalation/i),
    ).toBeTruthy();
    expect(getBoardState().elements).toHaveLength(0);
  });

  it('pushes a streamed `<board_add>` formula into the board store', () => {
    render(<Blackboard languagePreference="en" tradingName="Acacia Estates" />);

    // Drive the bridge hook directly — in production the streaming
    // chat surface holds these props in state via `useChatStream`.
    const { rerender } = renderHook(
      ({ text, id }: { text: string; id: string | null }) =>
        useChatBoardBridge({
          assistantText: text,
          messageId: id,
          isStreaming: true,
        }),
      { initialProps: { text: '', id: 'msg-1' } },
    );

    // Streamed delta arrives carrying the rent-yield formula tag.
    act(() => {
      rerender({ text: RENT_YIELD_FORMULA_TAG, id: 'msg-1' });
    });

    // Board store mirrors the chat event.
    expect(getBoardState().elements).toHaveLength(1);
    expect(getBoardState().elements[0]?.element.type).toBe('formula');

    // Visual: the Blackboard re-rendered with the element slot AND
    // the empty-state copy is gone.
    expect(screen.getByTestId('blackboard-slot-formula')).toBeTruthy();
    expect(
      screen.queryByText(/Ask about leases, rent escalation/i),
    ).toBeNull();
  });

  it('dedupes when the same tag id is delivered twice (idempotent)', () => {
    render(<Blackboard languagePreference="en" />);

    const { rerender } = renderHook(
      ({ text, id }: { text: string; id: string | null }) =>
        useChatBoardBridge({
          assistantText: text,
          messageId: id,
          isStreaming: true,
        }),
      { initialProps: { text: '', id: 'msg-1' } },
    );

    act(() => {
      rerender({ text: PORTFOLIO_DIAGRAM_TAG, id: 'msg-1' });
    });
    expect(getBoardState().elements).toHaveLength(1);

    // The streaming source re-delivers the same body — idempotent.
    act(() => {
      rerender({ text: PORTFOLIO_DIAGRAM_TAG + '\nstill streaming…', id: 'msg-1' });
    });
    expect(getBoardState().elements).toHaveLength(1);
    expect(getBoardState().elements[0]?.element.type).toBe('diagram');
  });

  it('resets the seen-set when the chat moves to a new turn', () => {
    const sameIdAcrossTurns = `<board_add>{"type":"text","id":"t-recap","body":{"en":"Recap.","sw":"Marudio."}}</board_add>`;
    const { rerender } = renderHook(
      ({ text, id }: { text: string; id: string | null }) =>
        useChatBoardBridge({
          assistantText: text,
          messageId: id,
          isStreaming: true,
        }),
      { initialProps: { text: '', id: 'msg-1' } },
    );

    act(() => {
      rerender({ text: sameIdAcrossTurns, id: 'msg-1' });
    });
    expect(getBoardState().elements).toHaveLength(1);

    // New chat turn — same element id (collision intentional). The
    // store's own dedupe keeps the count at 1 but updates the
    // envelope's messageId so the audit trail stays accurate.
    act(() => {
      rerender({ text: sameIdAcrossTurns, id: 'msg-2' });
    });
    expect(getBoardState().elements).toHaveLength(1);
    expect(getBoardState().elements[0]?.messageId).toBe('msg-2');
  });
});
