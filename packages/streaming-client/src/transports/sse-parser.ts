/**
 * Phase J8 — SSE wire-format parser.
 *
 * Extracted from `sse-chat-stream.ts` so each file stays under the
 * 250-line cap (anti-stall rule). The parser is pure / stateless and
 * trivially unit-testable.
 *
 * SSE spec recap:
 *   - Lines are separated by `\n` (some servers emit `\r\n`).
 *   - A frame is terminated by a blank line (`\n\n` or `\r\n\r\n`).
 *   - Each line is `<field>:<optional-space><value>`.
 *   - Lines starting with `:` are comments (heartbeats) — dropped.
 *   - Multiple `data:` lines per frame concat with `\n`.
 *   - `id:` sets the `Last-Event-Id` for resume on reconnect.
 */

import type { ChatStreamEvent } from '../types.js';

export interface ParsedFrame {
  event: string | null;
  id: string | null;
  data: string;
}

/**
 * Parse a "double-newline-terminated" SSE block into a frame.
 *
 * Exported so the test file can assert behaviour directly without
 * needing to spin up a fake server.
 */
export function parseSseFrame(raw: string): ParsedFrame {
  const frame: ParsedFrame = { event: null, id: null, data: '' };
  const lines = raw.split('\n');
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.length === 0) continue;
    // SSE comments — start with `:`. Heartbeats use these; drop.
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon);
    // Spec: optional single space after the colon.
    const value = line[colon + 1] === ' ' ? line.slice(colon + 2) : line.slice(colon + 1);
    if (field === 'event') frame.event = value;
    else if (field === 'id') frame.id = value;
    else if (field === 'data') dataLines.push(value);
  }
  frame.data = dataLines.join('\n');
  return frame;
}

/**
 * Best-effort cast — returns null when the JSON payload is malformed
 * OR the `type` field is missing. Callers route nulls to the rejected-
 * events counter instead of aborting the stream.
 */
export function tryParseChatStreamEvent(frame: ParsedFrame): ChatStreamEvent | null {
  if (!frame.data) return null;
  try {
    const parsed = JSON.parse(frame.data) as Partial<ChatStreamEvent>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof (parsed as { type?: unknown }).type !== 'string') return null;
    return parsed as ChatStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Drain a string buffer into a sequence of frames + the remaining
 * (unterminated) tail. Stateless — the transport owns the buffer.
 *
 * Returns:
 *   - `frames`: complete frames, oldest first
 *   - `rest`:   the trailing partial frame (caller appends next chunk)
 */
export function drainSseFrames(buffer: string): { frames: ParsedFrame[]; rest: string } {
  const frames: ParsedFrame[] = [];
  // Frames are separated by `\n\n`. Some servers emit `\r\n\r\n`.
  const sep = /\r?\n\r?\n/;
  let remaining = buffer;
  let match: RegExpExecArray | null;
  while ((match = sep.exec(remaining)) !== null) {
    const raw = remaining.slice(0, match.index);
    remaining = remaining.slice(match.index + match[0].length);
    frames.push(parseSseFrame(raw));
  }
  return { frames, rest: remaining };
}
