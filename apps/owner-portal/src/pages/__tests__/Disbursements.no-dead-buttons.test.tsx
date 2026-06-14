/**
 * Final-sweep detectors for the Disbursements page.
 *
 * Locks in two fixes:
 *   1. The expanded-row "View full report" button is no longer dead — it
 *      navigates to the real `/reports` route carrying the disbursement
 *      reference. A regression that drops the onClick makes click() a
 *      no-op and fails the navigation assertion.
 *   2. The month-grouping chart key is derived from the active UI locale
 *      (via `chartLocaleTag`), not the hard-coded `'en-KE'` jurisdiction
 *      literal. We assert the source no longer contains `en-KE`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';

const navigateSpy = vi.fn();

// next-intl passthrough: translator returns the key so labels are stable.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// react-router-dom: spy navigate, keep everything else intact.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// Tenant currency formatter — deterministic, no AuthContext needed.
vi.mock('../../hooks/useTenantCurrency', () => ({
  useTenantCurrencyFormatter: () => ({ format: (n: number) => `TZS ${n}` }),
}));

// Active UI locale — English for these assertions.
vi.mock('../../contexts/LocaleProvider', () => ({
  useLocaleContext: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

// API: one COMPLETED disbursement so the expanded row + actions render.
const getMock = vi.fn();
vi.mock('../../lib/api', () => ({
  api: { get: (...args: unknown[]) => getMock(...args) },
  formatDate: (s: string) => s,
  formatDateTime: (s: string) => s,
}));

import { DisbursementsPage } from '../financial/Disbursements';

const SAMPLE = {
  disbursements: [
    {
      id: 'd1',
      reference: 'DISB-001',
      amount: 1000,
      date: '2026-06-01T00:00:00.000Z',
      status: 'COMPLETED',
      method: 'BANK',
      period: 'Jun 2026',
      property: { id: 'p1', name: 'Mwenge Apartments' },
      breakdown: {
        rentCollected: 1200,
        managementFees: 120,
        maintenanceCosts: 40,
        utilities: 20,
        insurance: 10,
        repairs: 10,
        otherDeductions: 0,
        netDisbursement: 1000,
      },
    },
  ],
  stats: {
    totalDisbursed: 1000,
    pendingAmount: 0,
    nextDisbursementDate: '2026-07-01T00:00:00.000Z',
    yearToDate: 1000,
    averageMonthly: 1000,
  },
};

beforeEach(() => {
  navigateSpy.mockReset();
  getMock.mockReset();
  getMock.mockResolvedValue({ success: true, data: SAMPLE });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DisbursementsPage — no dead buttons', () => {
  it('navigates to the financial report when "View full report" is clicked', async () => {
    render(<DisbursementsPage />);

    // Wait for the row to render, then expand it.
    const row = await screen.findByText('DISB-001');
    fireEvent.click(row);

    const reportBtn = await screen.findByText('viewFullReport');
    fireEvent.click(reportBtn);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    const target = navigateSpy.mock.calls[0][0] as string;
    expect(target).toContain('/reports');
    expect(target).toContain('report=financial');
    expect(target).toContain('disbursement=DISB-001');
  });

  it('does not hard-code the en-KE jurisdiction locale in the chart grouping', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      path.resolve(here, '../financial/Disbursements.tsx'),
      'utf8',
    );
    expect(src).not.toContain("'en-KE'");
    expect(src).toContain('chartLocaleTag(locale)');
  });
});
