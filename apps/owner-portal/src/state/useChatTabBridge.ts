/**
 * useChatTabBridge — wire brain-emitted tab events into the owner-portal
 * tab store.
 *
 * The chat-ui widget runs `useChatStream` under the hood with an
 * `onEvent(event)` callback. This hook returns an onEvent handler that
 * recognises the five tab SSE shapes via `handleTabSseFrame` (from
 * @bossnyumba/chat-ui) and dispatches them into the singleton
 * `useOwnerTabs()` store.
 *
 * Why a separate hook (not inside the provider): the parser is a thin
 * dispatch fn, but the policy of which payloads to act on (spawn vs
 * propose, augment vs new tab) lives close to the consumer so the
 * provider can stay surface-agnostic.
 */

import { useCallback, useMemo } from 'react';
import {
  handleTabSseFrame,
  isKnownTabKind,
  pickPayloadTitle,
  type SpawnTabsBatch,
  type TabProposalPayload,
  type TabRemovePayload,
  type TabSpawnPayload,
  type TabUpdatePayload,
} from '@bossnyumba/chat-ui';
import { useOptionalOwnerTabs } from './OwnerTabsProvider';

export interface ChatStreamLikeEvent {
  readonly type?: unknown;
  // A parsed SSE frame is the JSON payload merged with the `type`
  // discriminator (see chat-ui's parseSseChunk). Beyond `type`, the
  // remaining fields vary by event — `payload`/`at` for the CT-1 tab
  // tags, `content` for deltas, `threadId`/`totalTokens` for turn_end,
  // etc. The bridge only reads `type` and re-serialises the whole
  // object for handleTabSseFrame, so the extra keys are part of the
  // contract rather than excess properties.
  readonly [key: string]: unknown;
}

export interface UseChatTabBridgeOptions {
  /** Owner's preferred locale — drives EN/SW title fallback. */
  readonly locale?: 'sw' | 'en';
  /** Optional sink for proposal chips; the caller renders them in chat. */
  readonly onProposal?: (payload: TabProposalPayload) => void;
  /** Optional sink for the legacy spawn_tabs candidate batch. */
  readonly onSpawnBatch?: (batch: SpawnTabsBatch) => void;
}

export interface UseChatTabBridgeApi {
  /** Pass this to `useChatStream({ onEvent })`. Routes tab events; ignores others. */
  onEvent(event: ChatStreamLikeEvent): void;
}

export function useChatTabBridge(
  options: UseChatTabBridgeOptions = {},
): UseChatTabBridgeApi {
  const tabs = useOptionalOwnerTabs();
  const locale = options.locale ?? 'en';
  const proposalSink = options.onProposal;
  const batchSink = options.onSpawnBatch;

  const onSpawn = useCallback(
    (payload: TabSpawnPayload) => {
      if (!tabs) return;
      if (!isKnownTabKind(payload.tabType)) return;
      const title = pickPayloadTitle(
        {
          title: payload.title,
          titleEn: payload.titleEn ?? undefined,
          titleSw: payload.titleSw ?? undefined,
        },
        locale,
      );
      tabs.spawnOrAugment({
        kind: payload.tabType,
        title,
        context: payload.config,
        explicitId: payload.tabId,
      });
    },
    [locale, tabs],
  );

  const onUpdate = useCallback(
    (payload: TabUpdatePayload) => {
      if (!tabs) return;
      if (payload.patch.title) {
        tabs.rename(payload.tabId, payload.patch.title);
      }
      const existing = tabs.tabs.find((t) => t.id === payload.tabId);
      if (existing && payload.patch.config) {
        tabs.spawnOrAugment({
          kind: existing.kind,
          title: existing.title,
          context: payload.patch.config,
          explicitId: payload.tabId,
        });
      }
    },
    [tabs],
  );

  const onRemove = useCallback(
    (payload: TabRemovePayload) => {
      if (!tabs) return;
      tabs.close(payload.tabId);
    },
    [tabs],
  );

  const onProposal = useCallback(
    (payload: TabProposalPayload) => {
      proposalSink?.(payload);
    },
    [proposalSink],
  );

  const onSpawnBatch = useCallback(
    (batch: SpawnTabsBatch) => {
      batchSink?.(batch);
    },
    [batchSink],
  );

  const onEvent = useCallback(
    (event: ChatStreamLikeEvent) => {
      const eventName =
        typeof event.type === 'string' ? event.type : null;
      if (!eventName) return;
      // The chat-ui useChatStream callback fires once per parsed SSE
      // frame — the event object IS the JSON payload (already merged
      // with the `type` discriminator from the SSE `event:` line). We
      // re-serialise so handleTabSseFrame's contract (rawData: string)
      // stays uniform with other surfaces that feed it raw stream chunks.
      handleTabSseFrame({
        eventName,
        rawData: JSON.stringify(event),
        handlers: {
          onSpawn,
          onUpdate,
          onRemove,
          onProposal,
          onSpawnBatch,
        },
      });
    },
    [onProposal, onRemove, onSpawn, onSpawnBatch, onUpdate],
  );

  return useMemo(() => ({ onEvent }), [onEvent]);
}
