/**
 * tab-sse-parser — client-side bridge between the brain SSE stream and
 * the owner-portal tab store.
 *
 * Ported from Borjie's apps/owner-web/src/lib/tab-sse-parser.ts and
 * adapted to BossNyumba's real-estate tab kinds + chat-ui location so
 * every consuming app (owner-portal, admin-platform-portal, future
 * estate-manager surfaces) shares the same parser instead of forking
 * its own.
 *
 * Five SSE event shapes the gateway emits inline with chat text (see
 * services/api-gateway/src/lib/chat-tab-bridge.ts):
 *
 *   - spawn_tabs      → legacy suggestion batch (chip strip)
 *   - tab_spawn       → spawn-or-augment in the FE store; tab pulses;
 *                       toast "Opened {title}".
 *   - tab_update      → patch context / title on an existing tabId.
 *   - tab_remove      → close (refuses pinned tabs).
 *   - tab_proposal    → render an accept / dismiss chip in chat;
 *                       acceptance binds to spawn-or-augment.
 *
 * This module is the SINGLE SEAM between the SSE stream and the
 * `useOwnerTabs()` store. The widget hook imports `handleTabSseFrame`
 * and dispatches; no React state lives here so the parser is unit-
 * testable in vitest-node.
 *
 * The parser is intentionally tolerant: malformed payloads are dropped
 * with a no-op (we cannot Pino on the client). Diagnostics live on
 * the gateway side.
 */

import { z } from 'zod';
import {
  OWNER_OS_TAB_TYPES,
  type OwnerOSTabType,
} from '@bossnyumba/owner-os-tabs';

// ─── Public payload schemas ─────────────────────────────────────────

const tabSourceSchema = z.enum(['brain', 'owner']);

/**
 * Free-form per-type config. Per-tab-type validation happens on the
 * gateway boundary; this layer only ensures the value is a JSON object.
 */
const configRecordSchema = z.record(z.string(), z.unknown());

export const tabSpawnPayloadSchema = z.object({
  tabId: z.string().min(1).max(160),
  tabType: z.string().min(1).max(40),
  title: z.string().min(1).max(60),
  titleEn: z.string().min(1).max(60).nullable().optional(),
  titleSw: z.string().min(1).max(60).nullable().optional(),
  config: configRecordSchema.default({}),
  source: tabSourceSchema,
});
export type TabSpawnPayload = z.infer<typeof tabSpawnPayloadSchema>;

export const tabUpdatePayloadSchema = z.object({
  tabId: z.string().min(1).max(160),
  patch: z.object({
    config: configRecordSchema.optional(),
    title: z.string().min(1).max(60).optional(),
  }),
  titleEn: z.string().min(1).max(60).nullable().optional(),
  titleSw: z.string().min(1).max(60).nullable().optional(),
  source: tabSourceSchema,
});
export type TabUpdatePayload = z.infer<typeof tabUpdatePayloadSchema>;

export const tabRemovePayloadSchema = z.object({
  tabId: z.string().min(1).max(160),
  source: tabSourceSchema,
});
export type TabRemovePayload = z.infer<typeof tabRemovePayloadSchema>;

export const tabProposalPayloadSchema = z.object({
  proposalId: z.string().min(1).max(200),
  tabType: z.string().min(1).max(40),
  title: z.string().min(1).max(60),
  titleEn: z.string().min(1).max(60).nullable().optional(),
  titleSw: z.string().min(1).max(60).nullable().optional(),
  reasonEn: z.string().min(1).max(200),
  reasonSw: z.string().min(1).max(200).nullable().optional(),
  evidenceIds: z.array(z.string().min(1)).min(1).max(5),
  confidence: z.number().min(0).max(1).nullable().optional(),
  config: configRecordSchema.default({}),
});
export type TabProposalPayload = z.infer<typeof tabProposalPayloadSchema>;

/**
 * Legacy `<spawn_tabs>` batch — the model emits this as ONE event
 * carrying up to 3 candidate tabs. The chip strip below the chat
 * bubble renders one chip per candidate; clicking calls
 * `spawnOrAugment(...)` on the store.
 */
export const spawnTabsCandidateSchema = z.object({
  type: z.string().min(1).max(40),
  context: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).optional(),
});
export type SpawnTabsCandidate = z.infer<typeof spawnTabsCandidateSchema>;

export const spawnTabsBatchSchema = z.object({
  tabs: z.array(spawnTabsCandidateSchema).max(3),
});
export type SpawnTabsBatch = z.infer<typeof spawnTabsBatchSchema>;

// ─── Dispatch handler interface ─────────────────────────────────────

export interface TabSseHandlers {
  onSpawnBatch?(batch: SpawnTabsBatch): void;
  onSpawn?(payload: TabSpawnPayload): void;
  onUpdate?(payload: TabUpdatePayload): void;
  onRemove?(payload: TabRemovePayload): void;
  onProposal?(payload: TabProposalPayload): void;
}

/**
 * Recognised SSE event names. Exported so callers can short-circuit
 * the routing without parsing the data when the event is irrelevant.
 */
export const TAB_SSE_EVENTS = [
  'spawn_tabs',
  'tab_spawn',
  'tab_update',
  'tab_remove',
  'tab_proposal',
] as const;
export type TabSseEvent = (typeof TAB_SSE_EVENTS)[number];

export function isTabSseEvent(eventName: string): eventName is TabSseEvent {
  return (TAB_SSE_EVENTS as ReadonlyArray<string>).includes(eventName);
}

/**
 * Parse one SSE frame's data + dispatch to the right handler. Returns
 * `true` when the event was a tab event AND parsed successfully (so
 * the caller can decide whether to also feed it to other parsers).
 *
 * Frame shape: `{ "payload": {...}, "at": "..." }` for the CT-1 tags;
 * `{ "batch": {...}, "at": "..." }` for the legacy spawn_tabs. The
 * parser accepts either shape and unwraps the inner payload.
 */
export function handleTabSseFrame(args: {
  readonly eventName: string;
  readonly rawData: string;
  readonly handlers: TabSseHandlers;
}): boolean {
  if (!isTabSseEvent(args.eventName)) return false;
  let raw: unknown;
  try {
    raw = JSON.parse(args.rawData);
  } catch {
    return false;
  }
  if (!raw || typeof raw !== 'object') return false;

  switch (args.eventName) {
    case 'spawn_tabs': {
      const batchEnv = (raw as { batch?: unknown }).batch ?? raw;
      const parsed = spawnTabsBatchSchema.safeParse(batchEnv);
      if (!parsed.success) return false;
      args.handlers.onSpawnBatch?.(parsed.data);
      return true;
    }
    case 'tab_spawn': {
      const payload = (raw as { payload?: unknown }).payload ?? raw;
      const parsed = tabSpawnPayloadSchema.safeParse(payload);
      if (!parsed.success) return false;
      args.handlers.onSpawn?.(parsed.data);
      return true;
    }
    case 'tab_update': {
      const payload = (raw as { payload?: unknown }).payload ?? raw;
      const parsed = tabUpdatePayloadSchema.safeParse(payload);
      if (!parsed.success) return false;
      args.handlers.onUpdate?.(parsed.data);
      return true;
    }
    case 'tab_remove': {
      const payload = (raw as { payload?: unknown }).payload ?? raw;
      const parsed = tabRemovePayloadSchema.safeParse(payload);
      if (!parsed.success) return false;
      args.handlers.onRemove?.(parsed.data);
      return true;
    }
    case 'tab_proposal': {
      const payload = (raw as { payload?: unknown }).payload ?? raw;
      const parsed = tabProposalPayloadSchema.safeParse(payload);
      if (!parsed.success) return false;
      args.handlers.onProposal?.(parsed.data);
      return true;
    }
    default:
      return false;
  }
}

// ─── Tab-kind guard ─────────────────────────────────────────────────

const TAB_KINDS: ReadonlySet<string> = new Set<string>(OWNER_OS_TAB_TYPES);

export function isKnownTabKind(s: string): s is OwnerOSTabType {
  return TAB_KINDS.has(s);
}

// ─── Locale-correct title pick ──────────────────────────────────────

/**
 * Pick the best title for a target locale. Falls back through:
 *   1. titleSw / titleEn  (locale-specific overrides)
 *   2. title              (default)
 */
export function pickPayloadTitle(
  payload: {
    readonly title: string;
    readonly titleEn?: string | null | undefined;
    readonly titleSw?: string | null | undefined;
  },
  locale: 'sw' | 'en',
): string {
  if (locale === 'sw' && payload.titleSw) return payload.titleSw;
  if (locale === 'en' && payload.titleEn) return payload.titleEn;
  return payload.title;
}

/** Same fallback policy for the proposal reason copy. */
export function pickProposalReason(
  payload: TabProposalPayload,
  locale: 'sw' | 'en',
): string {
  if (locale === 'sw' && payload.reasonSw) return payload.reasonSw;
  return payload.reasonEn;
}
