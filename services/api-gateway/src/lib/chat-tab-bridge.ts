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
 * chat bubble. But the brain now streams GENUINE tokens (see `streamTurn`),
 * so we must NOT collapse the live stream back into one delta. Instead this
 * bridge is an INCREMENTAL stripper: it forwards text the instant it is safe
 * to do so, and only holds back a trailing fragment when it could be the start
 * of a recognised `<spawn_tabs>` / `<tab_*>` tag — releasing or stripping it
 * the moment the tag completes (or is disambiguated as ordinary text). This
 * preserves real-time streaming for prose while keeping the tab DSL out of the
 * visible bubble, and preserves event ORDER (turn_start → live deltas + tab
 * events interleaved → proposed_action → turn_end).
 *
 * The bridge is intentionally narrow: it only touches the text payload.
 * Tool-call, handoff, proposed_action, and turn-end events pass through
 * untouched. The bridge is a generator → generator transformer so it
 * composes cleanly with `pipeStreamTurnToSSE` in ai-chat.router.ts.
 *
 * No DB writes, no audit chain, no Pino — pure transform. The FE owns
 * persistence for now (the tab store writes to localStorage).
 */

import {
  extractSpawnTabs,
  type OwnerOSSpawnBatch,
} from '@bossnyumba/owner-os-tabs';
import { extractTabTags } from '@bossnyumba/central-intelligence';
import type { StreamTurnEvent } from '@bossnyumba/ai-copilot';

/**
 * Extra SSE event shapes the bridge may yield. The chat-ui FE adds
 * these to its discriminator at the same time.
 */
export type TabBridgeEvent =
  | {
      readonly type: 'spawn_tabs';
      readonly batch: OwnerOSSpawnBatch;
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

// Recognised tag openers. Any `<` whose following characters are a PREFIX of
// one of these (or a complete opener) must be held back until the tag closes —
// everything else is ordinary prose and streams immediately.
const TAB_OPENERS: ReadonlyArray<string> = [
  '<spawn_tabs',
  '<tab_spawn',
  '<tab_update',
  '<tab_remove',
  '<tab_proposal',
];

/**
 * Given a buffer, return the index of the earliest `<` that could begin a
 * recognised tab opener (a full opener OR a partial prefix at the buffer tail).
 * Returns -1 when no such `<` exists — meaning the whole buffer is safe to emit.
 */
function earliestTabTagStart(buf: string): number {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== '<') continue;
    const rest = buf.slice(i);
    for (const opener of TAB_OPENERS) {
      // Complete opener present, OR `rest` is a partial prefix of the opener
      // still arriving (e.g. buffer ends mid-tag `<tab_sp`).
      if (rest.startsWith(opener) || opener.startsWith(rest)) return i;
    }
  }
  return -1;
}

/**
 * Does the buffer (assumed to start at a tab opener) contain a COMPLETE tag we
 * can safely strip? Self-closing `<tab_* ... />` end at the first `>`;
 * `<spawn_tabs>` is paired and ends at `</spawn_tabs>`.
 */
function hasCompleteTabTag(buf: string): boolean {
  if (buf.startsWith('<spawn_tabs')) {
    return buf.includes('</spawn_tabs>');
  }
  return buf.includes('>');
}

/**
 * Emit the tab events parsed out of a buffered segment (which begins with a
 * recognised tab opener). Returns the cleaned residual text (tags removed) so
 * the caller can continue scanning it.
 */
async function* emitTabEvents(
  segment: string,
): AsyncGenerator<{ readonly event: BridgedStreamEvent } | { readonly cleaned: string }> {
  // Order matters — spawn_tabs first (free-form JSON that may contain `<`
  // characters in evidence titles), then CT-1 self-closing tags.
  const spawn = extractSpawnTabs(segment);
  const tagged = extractTabTags(spawn.body);

  if (spawn.batch.tabs.length > 0) {
    yield {
      event: {
        type: 'spawn_tabs',
        batch: spawn.batch,
        at: new Date().toISOString(),
      },
    };
  }

  for (const tag of tagged.tags) {
    const now = new Date().toISOString();
    switch (tag.kind) {
      case 'tab_spawn':
        yield {
          event: {
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
          },
        };
        break;
      case 'tab_update':
        yield {
          event: {
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
          },
        };
        break;
      case 'tab_remove':
        yield {
          event: {
            type: 'tab_remove',
            payload: { tabId: tag.id, source: 'brain' as const },
            at: now,
          },
        };
        break;
      case 'tab_proposal':
        yield {
          event: {
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
          },
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

  // Residual text after tag removal (e.g. prose the brain put inside the
  // <spawn_tabs> blob region, or trailing text). Re-emit it as visible text.
  yield { cleaned: tagged.body };
}

/**
 * Wrap a `streamTurn` AsyncGenerator so any inline `<spawn_tabs>` /
 * `<tab_*>` tags are stripped from the visible deltas and re-emitted as their
 * own SSE events — WITHOUT collapsing the genuine live token stream.
 *
 * Incremental policy:
 *   - `pending` holds text not yet known to be safe to emit.
 *   - On each delta we emit everything up to the earliest `<` that could begin
 *     a recognised tab opener; the rest stays in `pending`.
 *   - When `pending` begins with a recognised opener AND the tag is complete,
 *     we strip it, emit the tab event(s), and keep scanning the remainder.
 *   - At stream end we flush whatever is left (any leaked/partial DSL is
 *     stripped by `extractTabTags`'s orphan-tag cleanup so nothing leaks).
 */
export async function* bridgeTabTags(
  source: AsyncGenerator<StreamTurnEvent>,
): AsyncGenerator<BridgedStreamEvent> {
  let pending = '';

  // Drain `pending` as far as is safe, yielding clean `delta`s + tab events.
  async function* drain(final: boolean): AsyncGenerator<BridgedStreamEvent> {
    for (;;) {
      const start = earliestTabTagStart(pending);
      if (start === -1) {
        // No possible tab tag — the whole buffer is safe prose.
        if (pending.length > 0) {
          yield { type: 'delta', content: pending };
          pending = '';
        }
        return;
      }
      // Emit the safe prose preceding the candidate tag.
      if (start > 0) {
        yield { type: 'delta', content: pending.slice(0, start) };
        pending = pending.slice(start);
      }
      // `pending` now begins at a tab-opener candidate.
      if (!hasCompleteTabTag(pending)) {
        // Tag still arriving. Hold UNLESS this is the final flush — then the
        // candidate never closed, so it is an orphan/partial DSL fragment.
        // `extractTabTags` only strips CLOSED tags (its regex needs a `>`), so
        // we drop the unclosed candidate region outright to guarantee no raw
        // DSL ever leaks into the visible bubble. Any safe prose preceding the
        // candidate `<` was already emitted above.
        if (final) {
          pending = '';
        }
        return;
      }
      // A complete tag is present at the head of `pending`. Find its end so we
      // only consume the tag region, leaving trailing tokens to stream live.
      const end = pending.startsWith('<spawn_tabs')
        ? pending.indexOf('</spawn_tabs>') + '</spawn_tabs>'.length
        : pending.indexOf('>') + 1;
      const segment = pending.slice(0, end);
      pending = pending.slice(end);

      for await (const out of emitTabEvents(segment)) {
        if ('event' in out) {
          yield out.event;
        } else if (out.cleaned.length > 0) {
          yield { type: 'delta', content: out.cleaned };
        }
      }
    }
  }

  try {
    for await (const event of source) {
      if (event.type === 'delta') {
        pending += event.content;
        yield* drain(false);
        continue;
      }
      // Non-delta boundary — flush whatever is safely emittable first so text
      // ordering relative to tool/handoff/proposed_action chips is preserved.
      yield* drain(false);
      yield event;
    }
  } finally {
    // Stream ended (or aborted) — flush the tail, stripping any partial DSL.
    yield* drain(true);
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
