/**
 * Integration test for the chat→tab bridge: a synthetic SSE event flows
 * through `useChatTabBridge.onEvent` and spawns / augments a tab in the
 * `useOwnerTabs` store.
 *
 * Covers the end-to-end client wiring without a real network round-trip
 * (the chat-ui's `parseSseChunk` + `useChatStream` happily handle these
 * payloads at runtime — `handleTabSseFrame` is the seam).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { OwnerTabsProvider, useOwnerTabs } from '../state/OwnerTabsProvider';
import { useChatTabBridge } from '../state/useChatTabBridge';

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

function withProvider({ children }: { children: ReactNode }) {
  return <OwnerTabsProvider>{children}</OwnerTabsProvider>;
}

describe('useChatTabBridge → useOwnerTabs', () => {
  it('opens a tab when the brain emits a tab_spawn SSE event', () => {
    const { result } = renderHook(
      () => ({
        bridge: useChatTabBridge(),
        tabs: useOwnerTabs(),
      }),
      { wrapper: withProvider },
    );
    expect(result.current.tabs.tabs).toHaveLength(1);

    act(() => {
      result.current.bridge.onEvent({
        type: 'tab_spawn',
        payload: {
          tabId: 'maintenance|propertyId:plot-23',
          tabType: 'maintenance',
          title: 'Maintenance — Plot 23',
          titleEn: null,
          titleSw: null,
          config: { propertyId: 'plot-23' },
          source: 'brain',
        },
        at: '2026-05-31T00:00:00.000Z',
      });
    });

    expect(result.current.tabs.tabs).toHaveLength(2);
    const spawned = result.current.tabs.tabs.find(
      (t) => t.id === 'maintenance|propertyId:plot-23',
    );
    expect(spawned?.kind).toBe('maintenance');
    expect(spawned?.title).toBe('Maintenance — Plot 23');
    expect(spawned?.context).toEqual({ propertyId: 'plot-23' });
  });

  it('drops events for unknown tab kinds without throwing', () => {
    const { result } = renderHook(
      () => ({
        bridge: useChatTabBridge(),
        tabs: useOwnerTabs(),
      }),
      { wrapper: withProvider },
    );

    act(() => {
      result.current.bridge.onEvent({
        type: 'tab_spawn',
        payload: {
          tabId: 'geology|siteId:mererani',
          tabType: 'geology', // Borjie mining-only kind
          title: 'Geology',
          config: {},
          source: 'brain',
        },
      });
    });

    // No new tab added — still only the pinned chat tab.
    expect(result.current.tabs.tabs).toHaveLength(1);
  });

  it('routes a tab_remove event into the close action', () => {
    const { result } = renderHook(
      () => ({
        bridge: useChatTabBridge(),
        tabs: useOwnerTabs(),
      }),
      { wrapper: withProvider },
    );

    // Spawn first, then close via the brain.
    act(() => {
      result.current.tabs.spawnOrAugment({
        kind: 'maintenance',
        title: 'Maintenance',
      });
    });
    expect(result.current.tabs.tabs).toHaveLength(2);

    act(() => {
      result.current.bridge.onEvent({
        type: 'tab_remove',
        payload: {
          tabId: 'maintenance',
          source: 'brain',
        },
      });
    });

    expect(result.current.tabs.tabs).toHaveLength(1);
  });

  it('ignores non-tab events (deltas, turn_end, etc.)', () => {
    const { result } = renderHook(
      () => ({
        bridge: useChatTabBridge(),
        tabs: useOwnerTabs(),
      }),
      { wrapper: withProvider },
    );

    act(() => {
      result.current.bridge.onEvent({
        type: 'delta',
        content: 'hello owner',
      });
      result.current.bridge.onEvent({
        type: 'turn_end',
        threadId: 't-1',
        finalPersonaId: 'owner-advisor',
        totalTokens: 100,
        totalCost: 0.001,
        timeMs: 500,
        advisorConsulted: false,
      });
    });

    expect(result.current.tabs.tabs).toHaveLength(1);
  });
});
