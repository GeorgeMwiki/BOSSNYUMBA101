/**
 * chat-tab-bridge — server-side transform that lifts brain-emitted tab
 * tags out of the SSE `delta` stream and re-emits them as discrete
 * `spawn_tabs` / `tab_spawn` / `tab_update` / `tab_remove` /
 * `tab_proposal` events the owner-portal FE can consume.
 *
 * Why this exists
 * ---------------
 * `streamTurn` in @bossnyumba/ai-copilot chunks the brain's final
 * `responseText` into fixed-size `delta` events. The brain's reply may
 * carry one or more of these inline-XML control tags:
 *
 *   <spawn_tabs>{...}</spawn_tabs>          legacy suggestion batch
 *   <tab_spawn type="..." title="..." />    CT-1 spawn
 *   <tab_update id="..." config='{...}' />  CT-1 patch
 *   <tab_remove id="..." />                 CT-1 close
 *   <tab_proposal type="..." reason="..." evidenceIds='["..."]' />
 *
 * If we forwarded the deltas verbatim the raw XML would leak into the
 * chat bubble. Instead we BUFFER deltas until the first non-delta event,
 * strip + parse the recognised tab tags, emit them as their own SSE
 * envelopes, and re-emit the cleaned text as a single `delta`. This
 * preserves event ORDER (turn_start → cleaned deltas → tab events →
 * proposed_action → turn_end) and keeps the brain reply visually clean.
 *
 * The bridge is intentionally narrow: it only touches the text payload.
 * Tool-call, handoff, proposed_action, and turn-end events pass through
 * untouched. The bridge is a generator → generator transformer so it
 * composes cleanly with `pipeStreamTurnToSSE` in ai-chat.router.ts.
 *
 * No DB writes, no audit chain, no Pino — pure transform. The FE owns
 * persistence for now (the tab store writes to localStorage).
 */

import { extractSpawnTabs } from '@bossnyumba/owner-os-tabs';
import { extractTabTags } from '@bossnyumba/central-intelligence';
import type { StreamTurnEvent } from '@bossnyumba/ai-copilot';

/**
 * Extra SSE event shapes the bridge may yield. The chat-ui FE adds
 * these to its discriminator at the same time.
 */
export type TabBridgeEvent =
  | {
      readonly type: 'spawn_tabs';
      readonly batch: { readonly tabs: ReadonlyArray<unknown> };
      readonly at: string;
    }
  | {
      readonly type: 'tab_spawn';
      readonly payload: Record<string, unknown>;
      readonly at: string;
    }
  | {
      readonly type: 'tab_update';
      readonly payload: Record<string, unknown>;
      readonly at: string;
    }
  | {
      readonly type: 'tab_remove';
      readonly payload: Record<string, unknown>;
      readonly at: string;
    }
  | {
      readonly type: 'tab_proposal';
      readonly payload: Record<string, unknown>;
      readonly at: string;
    };

export type BridgedStreamEvent = StreamTurnEvent | TabBridgeEvent;

/**
 * Wrap a `streamTurn` AsyncGenerator so any inline `<spawn_tabs>` /
 * `<tab_*>` tags are stripped from the visible deltas and re-emitted
 * as their own SSE events.
 *
 * Buffering policy:
 *   - All `delta` events before the FIRST non-delta event are joined
 *     into one buffer. Brain replies are short enough that buffering
 *     end-to-end is fine (≤10kB typical, hard-capped at 10_000 chars
 *     by the chat body schema).
 *   - At the boundary (or at end of stream) we parse, emit tab events,
 *     then emit a single `delta` with the cleaned body.
 *   - Subsequent deltas (rare — only when the brain interleaves text
 *     and tool calls) pass through unchanged.
 */
export async function* bridgeTabTags(
  source: AsyncGenerator<StreamTurnEvent>,
): AsyncGenerator<BridgedStreamEvent> {
  let buffer = '';
  let buffering = true;

  // Helper that drains the current text buffer, extracting tab tags
  // and yielding them in the correct order before the cleaned delta.
  async function* flushBuffer(): AsyncGenerator<BridgedStreamEvent> {
    if (!buffering) return;
    buffering = false;
    if (buffer.length === 0) return;

    // Order matters — spawn_tabs first (free-form JSON that may contain
    // `<` characters in evidence titles), then CT-1 self-closing tags.
    const spawn = extractSpawnTabs(buffer);
    const tagged = extractTabTags(spawn.body);

    const cleaned = tagged.body;
    if (cleaned.length > 0) {
      yield { type: 'delta', content: cleaned };
    }

    if (spawn.batch.tabs.length > 0) {
      yield {
        type: 'spawn_tabs',
        batch: spawn.batch,
        at: new Date().toISOString(),
      };
    }

    for (const tag of tagged.tags) {
      const now = new Date().toISOString();
      switch (tag.kind) {
        case 'tab_spawn':
          yield {
            type: 'tab_spawn',
            payload: {
              tabId: deriveTabSpawnId(tag.type, tag.config),
              tabType: tag.type,
              title: tag.title,
              titleEn: tag.titleEn ?? null,
              titleSw: tag.titleSw ?? null,
              config: tag.config,
              source: 'brain' as const,
            },
            at: now,
          };
          break;
        case 'tab_update':
          yield {
            type: 'tab_update',
            payload: {
              tabId: tag.id,
              patch: {
                ...(tag.config !== undefined ? { config: tag.config } : {}),
                ...(tag.title !== undefined ? { title: tag.title } : {}),
              },
              titleEn: tag.titleEn ?? null,
              titleSw: tag.titleSw ?? null,
              source: 'brain' as const,
            },
            at: now,
          };
          break;
        case 'tab_remove':
          yield {
            type: 'tab_remove',
            payload: { tabId: tag.id, source: 'brain' as const },
            at: now,
          };
          break;
        case 'tab_proposal':
          yield {
            type: 'tab_proposal',
            payload: {
              proposalId: `${tag.type}:${tag.evidenceIds[0] ?? 'no-evidence'}`,
              tabType: tag.type,
              title: tag.title,
              titleEn: tag.titleEn ?? null,
              titleSw: tag.titleSw ?? null,
              reasonEn: tag.reason,
              reasonSw: tag.reasonSw ?? null,
              evidenceIds: tag.evidenceIds,
              confidence: tag.confidence ?? null,
              config: tag.config,
            },
            at: now,
          };
          break;
        default: {
          // Exhaustiveness check — adding a new TabTag kind here is a
          // compile error until handled.
          const _exhaust: never = tag;
          void _exhaust;
        }
      }
    }
  }

  try {
    for await (const event of source) {
      if (buffering && event.type === 'delta') {
        buffer += event.content;
        continue;
      }
      // First non-delta — flush before forwarding the boundary event.
      if (buffering) {
        yield* flushBuffer();
      }
      yield event;
    }
  } finally {
    // Stream ended (or aborted before any non-delta) — flush whatever
    // text we accumulated so the FE still gets the message.
    if (buffering) {
      yield* flushBuffer();
    }
  }
}

/**
 * Deterministic id for a tab spawned by the brain. Mirrors the
 * `deterministicTabId` helper on the FE so the augment-or-spawn dedup
 * uses the same key on both sides. Built-ins keep their literal id.
 */
const BUILTIN_KINDS = new Set<string>([
  'chat',
  'docs',
  'drafts',
  'reminders',
  'insights',
  'doc-context',
]);

const SCOPING_KEYS: ReadonlyArray<string> = [
  'propertyId',
  'leaseId',
  'tenantId',
  'employeeId',
  'counterpartyId',
  'documentId',
];

function deriveTabSpawnId(
  kind: string,
  context: Readonly<Record<string, unknown>>,
): string {
  if (BUILTIN_KINDS.has(kind)) return kind;
  const parts: string[] = [kind];
  for (const key of SCOPING_KEYS) {
    const v = context[key];
    if (typeof v === 'string' && v.length > 0) {
      parts.push(`${key}:${v}`);
    }
  }
  return parts.join('|');
}
