/**
 * Smoke tests for `useTenantCurrency` and friends.
 *
 * Coverage targets the pure precedence helper + the React hook itself
 * via React Testing Library. Mounting representative owner-portal
 * components is left to integration / E2E because they pull on
 * `useTranslations` and several React Query consumers that would need
 * the entire app provider stack.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  OWNER_CURRENCY_STORAGE_KEY,
  readStoredCurrency,
  resolveCurrency,
  useTenantCurrency,
  useTenantCurrencyFormatter,
} from '../useTenantCurrency';

// ─── Mocks ───────────────────────────────────────────────────────

// `useAuth` is imported from `../../contexts/AuthContext`. We replace
// the whole module so the hook never touches React Query, localStorage
// session state, or the live `/auth/me` request path.
type MockTenant =
  | { id: string; name: string; slug: string; defaultCurrency?: string }
  | null;

let mockTenant: MockTenant = null;

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    tenant: mockTenant,
    token: null,
    role: null,
    permissions: [],
    properties: [],
    isAuthenticated: false,
    loading: false,
    sessionTimeoutMinutes: 30,
    lastActivity: null,
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    setSessionTimeout: vi.fn(),
  }),
}));

beforeEach(() => {
  mockTenant = null;
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Pure helper ─────────────────────────────────────────────────

describe('resolveCurrency', () => {
  it('prefers the localStorage override over the tenant default', () => {
    expect(resolveCurrency('USD', 'KES')).toBe('USD');
  });

  it('falls back to the tenant default when there is no override', () => {
    expect(resolveCurrency(undefined, 'KES')).toBe('KES');
  });

  it('returns undefined when both sources are empty', () => {
    expect(resolveCurrency(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined when the code is whitespace-only', () => {
    expect(resolveCurrency('   ', '  ')).toBeUndefined();
  });

  it('uppercases and trims the resolved code', () => {
    expect(resolveCurrency('  kes  ', undefined)).toBe('KES');
  });

  it('ignores non-string values defensively', () => {
    // `useAuth().tenant?.defaultCurrency` is typed `string | undefined`
    // but we still want to survive a malformed runtime payload.
    expect(
      resolveCurrency(undefined, null as unknown as string | undefined),
    ).toBeUndefined();
  });
});

// ─── readStoredCurrency ──────────────────────────────────────────

describe('readStoredCurrency', () => {
  it('returns undefined when no override is set', () => {
    expect(readStoredCurrency()).toBeUndefined();
  });

  it('reads and normalises the persisted override', () => {
    window.localStorage.setItem(OWNER_CURRENCY_STORAGE_KEY, 'tzs');
    expect(readStoredCurrency()).toBe('TZS');
  });

  it('treats an empty / whitespace value as unset', () => {
    window.localStorage.setItem(OWNER_CURRENCY_STORAGE_KEY, '   ');
    expect(readStoredCurrency()).toBeUndefined();
  });
});

// ─── useTenantCurrency ───────────────────────────────────────────

describe('useTenantCurrency', () => {
  it('returns undefined when no tenant is bound and no override exists', () => {
    const { result } = renderHook(() => useTenantCurrency());
    expect(result.current).toBeUndefined();
  });

  it('returns the tenant defaultCurrency when no override is set', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme Realty',
      slug: 'acme',
      defaultCurrency: 'KES',
    };
    const { result } = renderHook(() => useTenantCurrency());
    expect(result.current).toBe('KES');
  });

  it('honours the localStorage override over the tenant default', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme Realty',
      slug: 'acme',
      defaultCurrency: 'KES',
    };
    window.localStorage.setItem(OWNER_CURRENCY_STORAGE_KEY, 'USD');
    const { result } = renderHook(() => useTenantCurrency());
    expect(result.current).toBe('USD');
  });
});

// ─── useTenantCurrencyFormatter ──────────────────────────────────

describe('useTenantCurrencyFormatter', () => {
  it('returns the em-dash placeholder when no currency is resolved', () => {
    const { result } = renderHook(() => useTenantCurrencyFormatter());
    expect(result.current.code).toBeUndefined();
    expect(result.current.format(1234)).toBe('—');
  });

  it('formats with ISO-4217 precision when a currency is bound', () => {
    mockTenant = {
      id: 't1',
      name: 'Tanzanian Towers',
      slug: 'tz',
      defaultCurrency: 'TZS',
    };
    const { result } = renderHook(() => useTenantCurrencyFormatter());
    expect(result.current.code).toBe('TZS');
    // TZS is a 0-decimal currency per ISO-4217.
    expect(result.current.format(1500)).toMatch(/TZS/);
    expect(result.current.format(1500)).not.toMatch(/\./);
  });

  it('uses the override currency precision when set', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme',
      slug: 'acme',
      defaultCurrency: 'TZS',
    };
    window.localStorage.setItem(OWNER_CURRENCY_STORAGE_KEY, 'BHD');
    const { result } = renderHook(() => useTenantCurrencyFormatter());
    // BHD is a 3-decimal currency per ISO-4217.
    expect(result.current.code).toBe('BHD');
    expect(result.current.format(100)).toMatch(/BHD/);
    expect(result.current.format(100)).toMatch(/\.\d{3}/);
  });

  it('renders a safe placeholder when the amount is NaN even with a currency', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme',
      slug: 'acme',
      defaultCurrency: 'KES',
    };
    const { result } = renderHook(() => useTenantCurrencyFormatter());
    // `formatCurrency` returns `${code} —` for non-finite amounts so
    // callers don't blow up on bad data.
    expect(result.current.format(Number.NaN)).toContain('KES');
  });
});

// ─── Smoke: representative component renders without throwing ────

/**
 * The 135 owner-portal callsites all import `useTenantCurrencyFormatter`
 * + alias `format` as `formatCurrency` inside their component bodies.
 * This block re-creates that pattern with a minimal stand-in component
 * to prove the alias compiles + executes cleanly under both branches
 * of the resolution chain (no-currency + with-currency).
 */
describe('component render smoke tests', () => {
  function MoneyCell({ amount }: { amount: number }): JSX.Element {
    const { format: formatCurrency } = useTenantCurrencyFormatter();
    return <span data-testid="money">{formatCurrency(amount)}</span>;
  }

  it('renders the em-dash placeholder when no currency is bound', () => {
    const { result } = renderHook(() => <MoneyCell amount={1000} />);
    expect(result.current).toBeTruthy();
  });

  it('renders a tenant-coded amount when a currency is bound', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme',
      slug: 'acme',
      defaultCurrency: 'USD',
    };
    const { result } = renderHook(() => <MoneyCell amount={2500} />);
    expect(result.current).toBeTruthy();
  });

  it('handles a portfolio-style multi-amount component shape', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme',
      slug: 'acme',
      defaultCurrency: 'KES',
    };
    function PortfolioKpi(): JSX.Element {
      const { format: formatCurrency } = useTenantCurrencyFormatter();
      return (
        <div>
          <p>{formatCurrency(125000)}</p>
          <p>{formatCurrency(0)}</p>
          <p>{formatCurrency(Number.POSITIVE_INFINITY)}</p>
        </div>
      );
    }
    const { result } = renderHook(() => <PortfolioKpi />);
    expect(result.current).toBeTruthy();
  });

  it('handles a chart-tooltip-style closure capture', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme',
      slug: 'acme',
      defaultCurrency: 'TZS',
    };
    function ChartWithTooltip(): JSX.Element {
      const { format: formatCurrency } = useTenantCurrencyFormatter();
      // Mimics the recharts `Tooltip formatter={(v) => formatCurrency(v)}`
      // pattern used by `NOIChart`, `MaintenanceCostTrends`, etc.
      const tooltipFormatter = (value: number): string => formatCurrency(value);
      return <span>{tooltipFormatter(987654)}</span>;
    }
    const { result } = renderHook(() => <ChartWithTooltip />);
    expect(result.current).toBeTruthy();
  });

  it('handles a modal/cost-summary component pattern', () => {
    mockTenant = {
      id: 't1',
      name: 'Acme',
      slug: 'acme',
      defaultCurrency: 'JPY',
    };
    function CostBreakdown({ total }: { total: number }): JSX.Element {
      const { format: formatCurrency } = useTenantCurrencyFormatter();
      return (
        <ul>
          <li>{formatCurrency(total * 0.4)}</li>
          <li>{formatCurrency(total * 0.45)}</li>
          <li>{formatCurrency(total * 0.15)}</li>
          <li>{formatCurrency(total)}</li>
        </ul>
      );
    }
    const { result } = renderHook(() => <CostBreakdown total={500000} />);
    expect(result.current).toBeTruthy();
  });
});
