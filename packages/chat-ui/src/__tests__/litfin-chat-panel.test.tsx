/**
 * Live detectors for the public marketing chat panel (LitFinChatPanel).
 *
 * Guards three lows on the PUBLIC surface:
 *   1. Image-upload is a dead control on /api/chat (the route has no image
 *      field) — so the upload affordance must NOT render for portal=public.
 *   2. A structured AI error (503 ai_unavailable) must surface as a human
 *      sentence, never the raw `(ai_unavailable)` machine code.
 *   3. A stream that ends abnormally (terminal event / zero deltas) must
 *      settle the bubble instead of hanging in perpetual streaming.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement, forwardRef } from 'react';

// jsdom does not implement Element.prototype.scrollIntoView; the panel
// auto-scrolls to the newest message on render, so without this polyfill every
// full render throws 'scrollIntoView is not a function' (a jsdom gap, not a
// component bug — real browsers have it).
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn();
}

// framer-motion → plain elements so jsdom renders without animation work.
vi.mock('framer-motion', () => {
  const passthrough = (tag: string) =>
    forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const {
        initial: _i,
        animate: _a,
        exit: _e,
        transition: _t,
        whileHover: _wh,
        whileTap: _wt,
        ...rest
      } = props;
      return createElement(tag, { ...rest, ref });
    });
  return {
    motion: new Proxy(
      {},
      { get: (_t, key: string) => passthrough(key) },
    ),
    AnimatePresence: ({ children }: { children: unknown }) => children,
  };
});

vi.mock('@bossnyumba/design-system', () => ({
  Logomark: () => null,
}));

import { LitFinChatPanel, readEventStream } from '../widget/LitFinChatPanel';
import { LitFinAIProvider } from '../widget/LitFinAIProvider';

function renderPublicPanel() {
  return render(
    <LitFinAIProvider portalId="public" endpoint="/api/chat" initialRoute="/">
      <LitFinChatPanel onClose={() => undefined} />
    </LitFinAIProvider>,
  );
}

function sseStream(frames: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LitFinChatPanel — public surface', () => {
  it('does NOT render the image-upload control on the public portal', () => {
    renderPublicPanel();
    expect(
      screen.queryByRole('button', { name: /upload image|pakia picha/i }),
    ).toBeNull();
  });

  it('renders a human message, not the raw error code, on 503 ai_unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'ai_unavailable', detail: 'boom' }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      ),
    );
    renderPublicPanel();
    const input = screen.getByPlaceholderText(/ask mr\. mwikila/i);
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/unavailable right now/i)).toBeInTheDocument();
    });
    // The raw machine code must never reach the visitor.
    expect(screen.queryByText(/\(ai_unavailable\)/)).toBeNull();
  });
});

describe('readEventStream — abnormal end handling', () => {
  it('terminates cleanly on a terminal error event without hanging', async () => {
    const chunks: string[] = [];
    await readEventStream(
      sseStream([
        'event: turn_start\ndata: {}\n\n',
        'event: delta\ndata: {"content":"partial"}\n\n',
        'event: error\ndata: {"message":"upstream died"}\n\n',
        // Frames AFTER the terminal event must be ignored.
        'event: delta\ndata: {"content":"SHOULD-NOT-APPEAR"}\n\n',
      ]),
      (c) => chunks.push(c),
    );
    expect(chunks.join('')).toBe('partial');
    expect(chunks.join('')).not.toContain('SHOULD-NOT-APPEAR');
  });

  it('resolves on a transport-closed stream that produced zero deltas', async () => {
    const chunks: string[] = [];
    // Connection drops after turn_start with no delta and no terminal event.
    await readEventStream(
      sseStream(['event: turn_start\ndata: {}\n\n']),
      (c) => chunks.push(c),
    );
    // The promise must resolve (no hang) and yield no running text — the
    // caller's finally then settles the empty bubble to a fallback line.
    expect(chunks).toHaveLength(0);
  });
});
