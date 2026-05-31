/**
 * section-context-loader tests — verify the date-window logic that
 * gates the KRA / TRA / month-end sections, and the fail-closed
 * behaviour when the backend is unreachable.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sectionSignalKeys } from '@bossnyumba/dynamic-sections';
import { loadSectionContext } from '../lib/section-context-loader';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiGet = api.get as ReturnType<typeof vi.fn>;

function ctx(args: Partial<Parameters<typeof loadSectionContext>[0]> = {}) {
  return {
    tenantId: 't1',
    scope: 'owner-customer' as const,
    ...args,
  };
}

describe('section-context-loader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiGet.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero signals + zero counts on backend failure (fail-closed)', async () => {
    apiGet.mockRejectedValueOnce(new Error('network'));
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.activeLeases]).toBe(0);
    expect(snapshot.entityCounts[sectionSignalKeys.rentDueSoon]).toBe(0);
    expect(snapshot.roles).toEqual([]);
    expect(snapshot.featureFlags).toEqual([]);
  });

  it('maps backend counts onto the signal keys', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: {
        activeLeases: 12,
        rentDueSoon: 3,
        maintenanceOpen: 5,
        leaseRenewalWindow: 1,
        vacancyListings: 2,
        internalStaff: 7,
        roles: ['owner'],
        featureFlags: ['advisor_enabled'],
      },
    });
    vi.setSystemTime(new Date('2026-05-05T12:00:00Z')); // not filing window

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.activeLeases]).toBe(12);
    expect(snapshot.entityCounts[sectionSignalKeys.rentDueSoon]).toBe(3);
    expect(snapshot.entityCounts[sectionSignalKeys.maintenanceOpen]).toBe(5);
    expect(snapshot.entityCounts[sectionSignalKeys.leaseRenewalWindow]).toBe(1);
    expect(snapshot.entityCounts[sectionSignalKeys.vacancyListings]).toBe(2);
    expect(snapshot.entityCounts[sectionSignalKeys.internalStaff]).toBe(7);
    expect(snapshot.roles).toEqual(['owner']);
    expect(snapshot.featureFlags).toEqual(['advisor_enabled']);
  });

  it('opens the KRA VAT window for a KE tenant on the 15th', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: { jurisdiction: 'KE' },
    });
    vi.setSystemTime(new Date('2026-05-15T08:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.kraVatFilingWindow]).toBe(1);
    expect(snapshot.entityCounts[sectionSignalKeys.traVatFilingWindow]).toBe(0);
  });

  it('keeps the KRA VAT window closed outside the 10th-20th band', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: { jurisdiction: 'KE' },
    });
    vi.setSystemTime(new Date('2026-05-05T08:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.kraVatFilingWindow]).toBe(0);
  });

  it('opens the TRA VAT window for a TZ tenant on the 20th (inclusive)', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: { jurisdiction: 'TZ' },
    });
    vi.setSystemTime(new Date('2026-05-20T08:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.traVatFilingWindow]).toBe(1);
    expect(snapshot.entityCounts[sectionSignalKeys.kraVatFilingWindow]).toBe(0);
  });

  it('keeps both VAT windows closed when the tenant has no jurisdiction', async () => {
    apiGet.mockResolvedValueOnce({
      success: true,
      data: { jurisdiction: null },
    });
    vi.setSystemTime(new Date('2026-05-15T08:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.kraVatFilingWindow]).toBe(0);
    expect(snapshot.entityCounts[sectionSignalKeys.traVatFilingWindow]).toBe(0);
  });

  it('opens the month-end window during the last 5 days', async () => {
    apiGet.mockResolvedValueOnce({ success: true, data: {} });
    vi.setSystemTime(new Date('2026-05-30T08:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.accountantMonthEnd]).toBe(1);
  });

  it('keeps the month-end window closed mid-month', async () => {
    apiGet.mockResolvedValueOnce({ success: true, data: {} });
    vi.setSystemTime(new Date('2026-05-15T08:00:00Z'));

    const snapshot = await loadSectionContext(ctx());

    expect(snapshot.entityCounts[sectionSignalKeys.accountantMonthEnd]).toBe(0);
  });
});
