/**
 * Unit tests for `tab-sse-parser` — the seam between the brain SSE
 * stream and the owner-portal tab store. The parser is pure (no React,
 * no I/O) so vitest-node is enough.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  handleTabSseFrame,
  isTabSseEvent,
  isKnownTabKind,
  pickPayloadTitle,
  pickProposalReason,
  type TabProposalPayload,
} from '../lib/tab-sse-parser';

describe('isTabSseEvent', () => {
  it('returns true for the five recognised event names', () => {
    expect(isTabSseEvent('spawn_tabs')).toBe(true);
    expect(isTabSseEvent('tab_spawn')).toBe(true);
    expect(isTabSseEvent('tab_update')).toBe(true);
    expect(isTabSseEvent('tab_remove')).toBe(true);
    expect(isTabSseEvent('tab_proposal')).toBe(true);
  });

  it('returns false for unrelated event names', () => {
    expect(isTabSseEvent('delta')).toBe(false);
    expect(isTabSseEvent('turn_end')).toBe(false);
    expect(isTabSseEvent('')).toBe(false);
  });
});

describe('isKnownTabKind', () => {
  it('accepts the BN real-estate tab kinds', () => {
    expect(isKnownTabKind('chat')).toBe(true);
    expect(isKnownTabKind('rent')).toBe(true);
    expect(isKnownTabKind('maintenance')).toBe(true);
    expect(isKnownTabKind('compliance')).toBe(true);
  });

  it('rejects mining-domain kinds the Borjie source uses', () => {
    // Defensive: the Borjie registry has `geology` / `esg` / `sites`
    // that BN deliberately does not register. Drop instead of crash.
    expect(isKnownTabKind('geology')).toBe(false);
    expect(isKnownTabKind('esg')).toBe(false);
    expect(isKnownTabKind('sites')).toBe(false);
  });

  it('rejects empty / garbage strings', () => {
    expect(isKnownTabKind('')).toBe(false);
    expect(isKnownTabKind('not-a-tab')).toBe(false);
  });
});

describe('handleTabSseFrame', () => {
  it('returns false for non-tab events without invoking handlers', () => {
    const handlers = {
      onSpawn: vi.fn(),
      onSpawnBatch: vi.fn(),
    };
    const ok = handleTabSseFrame({
      eventName: 'delta',
      rawData: '{"content":"hello"}',
      handlers,
    });
    expect(ok).toBe(false);
    expect(handlers.onSpawn).not.toHaveBeenCalled();
    expect(handlers.onSpawnBatch).not.toHaveBeenCalled();
  });

  it('routes spawn_tabs batches to onSpawnBatch', () => {
    const onSpawnBatch = vi.fn();
    const data = JSON.stringify({
      batch: {
        tabs: [
          {
            type: 'compliance',
            context: { focus: 'NEMC EIA Geita' },
            reason: 'Renewal due in 12 days',
          },
        ],
      },
      at: '2026-05-31T00:00:00.000Z',
    });
    const ok = handleTabSseFrame({
      eventName: 'spawn_tabs',
      rawData: data,
      handlers: { onSpawnBatch },
    });
    expect(ok).toBe(true);
    expect(onSpawnBatch).toHaveBeenCalledTimes(1);
    expect(onSpawnBatch.mock.calls[0]?.[0]).toEqual({
      tabs: [
        {
          type: 'compliance',
          context: { focus: 'NEMC EIA Geita' },
          reason: 'Renewal due in 12 days',
        },
      ],
    });
  });

  it('routes tab_spawn envelopes to onSpawn with the parsed payload', () => {
    const onSpawn = vi.fn();
    const data = JSON.stringify({
      payload: {
        tabId: 'maintenance|propertyId:plot-23',
        tabType: 'maintenance',
        title: 'Maintenance — Plot 23',
        config: { propertyId: 'plot-23' },
        source: 'brain',
      },
      at: '2026-05-31T00:00:00.000Z',
    });
    const ok = handleTabSseFrame({
      eventName: 'tab_spawn',
      rawData: data,
      handlers: { onSpawn },
    });
    expect(ok).toBe(true);
    expect(onSpawn).toHaveBeenCalledTimes(1);
    expect(onSpawn.mock.calls[0]?.[0].tabId).toBe(
      'maintenance|propertyId:plot-23',
    );
    expect(onSpawn.mock.calls[0]?.[0].source).toBe('brain');
  });

  it('drops malformed JSON without throwing', () => {
    const onSpawn = vi.fn();
    const ok = handleTabSseFrame({
      eventName: 'tab_spawn',
      rawData: '{not json',
      handlers: { onSpawn },
    });
    expect(ok).toBe(false);
    expect(onSpawn).not.toHaveBeenCalled();
  });

  it('drops payloads that fail schema validation', () => {
    const onSpawn = vi.fn();
    // missing required `title` field
    const data = JSON.stringify({
      payload: {
        tabId: 'maintenance',
        tabType: 'maintenance',
        config: {},
        source: 'brain',
      },
    });
    const ok = handleTabSseFrame({
      eventName: 'tab_spawn',
      rawData: data,
      handlers: { onSpawn },
    });
    expect(ok).toBe(false);
    expect(onSpawn).not.toHaveBeenCalled();
  });
});

describe('pickPayloadTitle', () => {
  it('returns the SW title when locale is sw and titleSw is present', () => {
    const out = pickPayloadTitle(
      { title: 'Compliance', titleSw: 'Utii', titleEn: 'Compliance' },
      'sw',
    );
    expect(out).toBe('Utii');
  });

  it('falls back to title when the locale-specific override is missing', () => {
    const out = pickPayloadTitle({ title: 'Compliance' }, 'sw');
    expect(out).toBe('Compliance');
  });
});

describe('pickProposalReason', () => {
  it('returns reasonSw when locale is sw and reasonSw is present', () => {
    const payload: TabProposalPayload = {
      proposalId: 'compliance:ev-1',
      tabType: 'compliance',
      title: 'Compliance',
      reasonEn: 'NEMC due in 12 days',
      reasonSw: 'NEMC inaisha siku 12',
      evidenceIds: ['ev-1'],
      config: {},
    };
    expect(pickProposalReason(payload, 'sw')).toBe('NEMC inaisha siku 12');
    expect(pickProposalReason(payload, 'en')).toBe('NEMC due in 12 days');
  });

  it('falls back to reasonEn when reasonSw is missing', () => {
    const payload: TabProposalPayload = {
      proposalId: 'compliance:ev-1',
      tabType: 'compliance',
      title: 'Compliance',
      reasonEn: 'NEMC due in 12 days',
      evidenceIds: ['ev-1'],
      config: {},
    };
    expect(pickProposalReason(payload, 'sw')).toBe('NEMC due in 12 days');
  });
});
