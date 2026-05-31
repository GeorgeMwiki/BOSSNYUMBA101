/**
 * Tests for the owner-portal tab store (`useOwnerTabs` + reducer
 * helpers). Covers:
 *   - default state has the pinned `chat` tab and no others
 *   - spawnOrAugment opens a new tab when none matches the id
 *   - spawnOrAugment AUGMENTS an existing tab when ids collide
 *   - mergeTabContext promotes conflicting scalars to deduped arrays
 *   - deterministicTabId mirrors the gateway's id derivation
 *   - close refuses to remove pinned tabs
 *   - focus clears the pendingUpdates badge
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOwnerTabs as useOwnerTabsHook } from '../state/useOwnerTabs';
import {
  deterministicTabId,
  mergeTabContext,
} from '../state/useOwnerTabs';

beforeEach(() => {
  // Each test gets a clean localStorage so DEFAULT_STATE is hydrated.
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});

describe('deterministicTabId', () => {
  it('returns the literal id for built-in kinds', () => {
    expect(deterministicTabId('chat', {})).toBe('chat');
    expect(deterministicTabId('docs', { propertyId: 'p-1' })).toBe('docs');
  });

  it('builds a stable composite id from scoping keys', () => {
    const id = deterministicTabId('maintenance', { propertyId: 'plot-23' });
    expect(id).toBe('maintenance|propertyId:plot-23');
  });

  it('produces the SAME id regardless of unrelated context fields', () => {
    const a = deterministicTabId('compliance', { propertyId: 'p-9', focus: 'NEMC' });
    const b = deterministicTabId('compliance', { propertyId: 'p-9', focus: 'BoT' });
    expect(a).toBe(b);
  });
});

describe('mergeTabContext', () => {
  it('returns next when prev is undefined', () => {
    expect(mergeTabContext(undefined, { focus: 'NEMC' })).toEqual({
      focus: 'NEMC',
    });
  });

  it('promotes conflicting scalars to deduped arrays', () => {
    const out = mergeTabContext(
      { focus: 'NEMC EIA Geita' },
      { focus: 'BoT gold-window' },
    );
    expect(out).toEqual({ focus: ['NEMC EIA Geita', 'BoT gold-window'] });
  });

  it('deduplicates repeated focuses', () => {
    const out = mergeTabContext(
      { focus: ['NEMC', 'BoT'] },
      { focus: 'NEMC' },
    );
    expect(out).toEqual({ focus: ['NEMC', 'BoT'] });
  });

  it('shallow-merges two objects', () => {
    const out = mergeTabContext(
      { extra: { a: 1 } },
      { extra: { b: 2 } },
    );
    expect(out).toEqual({ extra: { a: 1, b: 2 } });
  });
});

describe('useOwnerTabs', () => {
  it('starts with the pinned chat tab as the active tab', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.id).toBe('chat');
    expect(result.current.tabs[0]?.pinned).toBe(true);
    expect(result.current.activeTabId).toBe('chat');
  });

  it('spawnOrAugment opens a fresh tab when no match', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    act(() => {
      result.current.spawnOrAugment({
        kind: 'maintenance',
        title: 'Maintenance',
        context: { propertyId: 'plot-23' },
      });
    });
    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTabId).toBe('maintenance|propertyId:plot-23');
    const tab = result.current.tabs.find(
      (t) => t.id === 'maintenance|propertyId:plot-23',
    );
    expect(tab?.kind).toBe('maintenance');
  });

  it('spawnOrAugment AUGMENTS instead of duplicating on id collision', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    act(() => {
      result.current.spawnOrAugment({
        kind: 'compliance',
        title: 'Compliance',
        context: { focus: 'NEMC Geita' },
      });
    });
    expect(result.current.tabs).toHaveLength(2);
    act(() => {
      result.current.spawnOrAugment({
        kind: 'compliance',
        title: 'Compliance',
        context: { focus: 'BoT gold-window' },
      });
    });
    // STILL only 2 tabs — augment in place.
    expect(result.current.tabs).toHaveLength(2);
    const tab = result.current.tabs.find((t) => t.id === 'compliance');
    expect(tab?.context).toEqual({
      focus: ['NEMC Geita', 'BoT gold-window'],
    });
    expect(tab?.augmentedAt).toBeTypeOf('string');
  });

  it('augmentation while another tab is active increments pendingUpdates', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    act(() => {
      result.current.spawnOrAugment({
        kind: 'compliance',
        title: 'Compliance',
        context: { focus: 'NEMC' },
      });
    });
    // Focus a DIFFERENT tab (chat) so compliance becomes background.
    act(() => {
      result.current.focus('chat');
    });
    act(() => {
      result.current.spawnOrAugment({
        kind: 'compliance',
        title: 'Compliance',
        context: { focus: 'BoT' },
      });
    });
    const tab = result.current.tabs.find((t) => t.id === 'compliance');
    expect(tab?.pendingUpdates).toBe(1);
  });

  it('focus clears the pendingUpdates badge', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    act(() => {
      result.current.spawnOrAugment({
        kind: 'compliance',
        title: 'Compliance',
        context: { focus: 'NEMC' },
      });
      result.current.focus('chat');
      result.current.spawnOrAugment({
        kind: 'compliance',
        title: 'Compliance',
        context: { focus: 'BoT' },
      });
    });
    expect(
      result.current.tabs.find((t) => t.id === 'compliance')?.pendingUpdates,
    ).toBe(1);
    act(() => {
      result.current.focus('compliance');
    });
    expect(
      result.current.tabs.find((t) => t.id === 'compliance')?.pendingUpdates,
    ).toBe(0);
  });

  it('close removes non-pinned tabs', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    act(() => {
      result.current.spawnOrAugment({
        kind: 'maintenance',
        title: 'Maintenance',
      });
    });
    expect(result.current.tabs).toHaveLength(2);
    act(() => {
      result.current.close('maintenance');
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe('chat');
  });

  it('close refuses to remove pinned tabs', () => {
    const { result } = renderHook(() => useOwnerTabsHook());
    act(() => {
      result.current.close('chat');
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.id).toBe('chat');
  });
});
