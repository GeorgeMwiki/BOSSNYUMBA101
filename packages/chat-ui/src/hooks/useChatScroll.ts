'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * useChatScroll — the ONE canonical streaming-scroll behaviour for every chat
 * surface (engineering §5.1). Kills the three classic streaming bugs:
 *
 *   1. JITTER — a per-frame `behavior:'smooth'` scroll that shakes as tokens land.
 *   2. CHASE-THE-END — the thread tracking the latest token so the reader only
 *      ever sees the bottom of the reply.
 *   3. THE YANK — dragging a reader who scrolled up back to the bottom on every
 *      streamed token.
 *
 * Behaviour:
 *   - Tail-follow is OPT-IN: we auto-scroll ONLY while the user is already at the
 *     bottom (within an ~80px tolerance band). The instant they scroll up we stop
 *     following and never yank them back.
 *   - Follow is INSTANT during streaming (`behavior:'auto'` — no per-frame smooth
 *     animation) and settles SMOOTHLY once the reply completes.
 *   - `atBottom` drives an optional "jump to latest" pill; `jumpToBottom` re-locks.
 *
 * Pass the SCROLL CONTAINER ref (the `overflow-y:auto` element), the streaming
 * dependency (the messages array / token tick), and whether a reply is currently
 * streaming. Reuse on EVERY chat surface so the behaviour can never drift.
 */
export function useChatScroll(
  scrollRef: RefObject<HTMLElement | null>,
  dep: unknown,
  streaming: boolean,
): { readonly atBottom: boolean; readonly jumpToBottom: () => void } {
  // Sticky lock: are we currently following the bottom? Held in a ref so the
  // follow effect reads the latest value without re-subscribing.
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  // SCROLL-INTENT: track whether the user is at the bottom. A user scroll up
  // releases the lock; scrolling back into the tolerance band re-engages it.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = (): void => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const isBottom = distance <= 80;
      stickRef.current = isBottom;
      setAtBottom(isBottom);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  // FOLLOW: only while locked to the bottom. Instant during streaming, smooth on
  // settle. Never fires when the reader has scrolled up (stickRef === false).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streaming ? 'auto' : 'smooth' });
  }, [scrollRef, dep, streaming]);

  const jumpToBottom = useCallback((): void => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    setAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [scrollRef]);

  return { atBottom, jumpToBottom };
}
