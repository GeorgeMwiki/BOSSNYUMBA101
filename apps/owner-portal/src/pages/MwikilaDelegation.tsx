/**
 * Mr. Mwikila delegation page — 12 categories × T0-T3 tier picker.
 *
 * The owner sets, per category, how autonomously Mwikila may act:
 *   T0  inform-only       owner does the action
 *   T1  propose           owner one-tap approves
 *   T2  act-with-reversal reversible within window_hours
 *   T3  irrevocable        rare; explicit owner elevation
 *
 * Each row also exposes the reversal-window (in hours) and the
 * envelope-threshold (with currency picker) so the owner caps the
 * money-out per category.
 *
 * Reads /api/v1/mwikila/delegations and writes via
 * PATCH /api/v1/mwikila/delegations/:category.
 *
 * Ported from Borjie apps/owner-web/src/app/(routes)/mwikila/
 * delegation/delegation-matrix.tsx — adapted for Vite + real-estate
 * categories (mig 0290 CHECK).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';

const CATEGORIES = [
  'rent-scheduling',
  'regulatory-filings',
  'lease-renewals',
  'payroll-prep',
  'listing-counter-offers',
  'maintenance-approvals-low-value',
  'tenant-communications',
  'evictions-initial-notice',
  'capex',
  'inventory',
  'marketplace-listings',
  'contractor-engagement',
] as const;
type Category = (typeof CATEGORIES)[number];

const TIERS = ['T0', 'T1', 'T2', 'T3'] as const;
type Tier = (typeof TIERS)[number];

const CURRENCIES = ['TZS', 'KES', 'UGX', 'USD', 'EUR'] as const;

const CATEGORY_LABELS_EN: Record<Category, string> = {
  'rent-scheduling': 'Rent invoice scheduling',
  'regulatory-filings': 'Regulatory filings',
  'lease-renewals': 'Lease renewals',
  'payroll-prep': 'Payroll preparation',
  'listing-counter-offers': 'Listing counter offers',
  'maintenance-approvals-low-value': 'Maintenance approvals (low value)',
  'tenant-communications': 'Tenant communications',
  'evictions-initial-notice': 'Eviction initial notices',
  capex: 'Capital expenditure',
  inventory: 'Inventory orders',
  'marketplace-listings': 'Marketplace listings',
  'contractor-engagement': 'Contractor engagement',
};

const CATEGORY_LABELS_SW: Record<Category, string> = {
  'rent-scheduling': 'Ratiba ya ankara za kodi',
  'regulatory-filings': 'Mawasiliano ya kisheria',
  'lease-renewals': 'Upya wa mikataba',
  'payroll-prep': 'Maandalizi ya mshahara',
  'listing-counter-offers': 'Bei mbadala za nyumba',
  'maintenance-approvals-low-value': 'Idhini ya matengenezo ya kawaida',
  'tenant-communications': 'Mawasiliano na wapangaji',
  'evictions-initial-notice': 'Notisi ya kuondoa mpangaji',
  capex: 'Matumizi makubwa',
  inventory: 'Manunuzi ya vifaa',
  'marketplace-listings': 'Matangazo ya nyumba',
  'contractor-engagement': 'Mikataba ya wakandarasi',
};

interface DelegationPref {
  readonly category: Category;
  readonly tier: Tier;
  readonly reversalWindowHours: number | null;
  readonly envelopeThreshold: number | null;
  readonly envelopeThresholdCurrency: string;
  readonly notes: string | null;
}

interface DelegationEditState {
  readonly tier: Tier;
  readonly reversalWindowHours: number | '';
  readonly envelopeThreshold: number | '';
  readonly envelopeThresholdCurrency: string;
  readonly notes: string;
  readonly dirty: boolean;
}

function toEdit(pref: DelegationPref | undefined): DelegationEditState {
  return {
    tier: pref?.tier ?? 'T0',
    reversalWindowHours: pref?.reversalWindowHours ?? '',
    envelopeThreshold: pref?.envelopeThreshold ?? '',
    envelopeThresholdCurrency: pref?.envelopeThresholdCurrency ?? 'TZS',
    notes: pref?.notes ?? '',
    dirty: false,
  };
}

const TIER_DESC_EN: Record<Tier, string> = {
  T0: 'Inform only — owner acts',
  T1: 'Propose — owner one-tap approves',
  T2: 'Act with reversal — owner can reverse',
  T3: 'Irrevocable — owner has explicitly raised',
};

const TIER_DESC_SW: Record<Tier, string> = {
  T0: 'Onyesha tu — mwenye nyumba anachukua hatua',
  T1: 'Pendekeza — idhini ya bofyo moja',
  T2: 'Tenda na uwezo wa kutendua',
  T3: 'Hairuhusu kutendua — mwenye nyumba ameongeza',
};

interface MwikilaDelegationProps {
  readonly languagePreference?: 'sw' | 'en';
}

export default function MwikilaDelegation({
  languagePreference = 'sw',
}: MwikilaDelegationProps): JSX.Element {
  const [prefs, setPrefs] = useState<ReadonlyArray<DelegationPref>>([]);
  const [edits, setEdits] = useState<Record<Category, DelegationEditState>>(
    () =>
      Object.fromEntries(
        CATEGORIES.map((c) => [c, toEdit(undefined)] as const),
      ) as Record<Category, DelegationEditState>,
  );
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const sw = languagePreference === 'sw';
  const labels = sw ? CATEGORY_LABELS_SW : CATEGORY_LABELS_EN;
  const tierDescs = sw ? TIER_DESC_SW : TIER_DESC_EN;

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get<ReadonlyArray<DelegationPref>>(
        '/mwikila/delegations',
      );
      if (res.success && Array.isArray(res.data)) {
        setPrefs(res.data);
        const next = Object.fromEntries(
          CATEGORIES.map((c) => [
            c,
            toEdit(res.data!.find((p) => p.category === c)),
          ] as const),
        ) as Record<Category, DelegationEditState>;
        setEdits(next);
      } else {
        setErrorMsg(res.error?.message ?? 'Failed to load delegations');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onChange = useCallback(
    (category: Category, patch: Partial<Omit<DelegationEditState, 'dirty'>>) => {
      setEdits((prev) => ({
        ...prev,
        [category]: { ...prev[category], ...patch, dirty: true },
      }));
    },
    [],
  );

  const onReset = useCallback(
    (category: Category) => {
      setEdits((prev) => ({
        ...prev,
        [category]: toEdit(prefs.find((p) => p.category === category)),
      }));
    },
    [prefs],
  );

  const onSave = useCallback(
    async (category: Category) => {
      const e = edits[category];
      const body = {
        tier: e.tier,
        reversalWindowHours:
          e.reversalWindowHours === '' ? null : e.reversalWindowHours,
        envelopeThreshold:
          e.envelopeThreshold === '' ? null : e.envelopeThreshold,
        envelopeThresholdCurrency: e.envelopeThresholdCurrency,
        notes: e.notes || null,
      };
      const res = await api.patch(`/mwikila/delegations/${category}`, body);
      if (!res.success) {
        setErrorMsg(res.error?.message ?? 'Save failed');
        return;
      }
      await refresh();
    },
    [edits, refresh],
  );

  const totalDirty = useMemo(
    () => Object.values(edits).filter((e) => e.dirty).length,
    [edits],
  );

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {sw ? 'Mr. Mwikila — Mgawanyo wa wajibu' : 'Mr. Mwikila — Delegation matrix'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {sw
              ? 'Chagua kiwango cha uhuru kwa kila kategoria. T0=onyesha tu, T3=usitendue.'
              : 'Pick how autonomously Mwikila may act per category. T0=inform-only, T3=irrevocable.'}
          </p>
        </div>
        <div className="text-sm text-zinc-500">
          {sw ? `Mabadiliko: ${totalDirty}` : `Pending changes: ${totalDirty}`}
        </div>
      </header>

      {errorMsg !== null && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">
          {sw ? 'Inapakia…' : 'Loading…'}
        </div>
      ) : (
        <div className="grid gap-3">
          {CATEGORIES.map((category) => {
            const e = edits[category];
            return (
              <div
                key={category}
                className="grid grid-cols-1 gap-3 rounded border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto]"
                data-testid="mwikila-delegation-row"
              >
                <div>
                  <h3 className="text-sm font-medium text-zinc-900">
                    {labels[category]}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">{tierDescs[e.tier]}</p>
                </div>
                <label className="flex flex-col text-xs text-zinc-700">
                  {sw ? 'Kiwango' : 'Tier'}
                  <select
                    value={e.tier}
                    onChange={(ev) =>
                      onChange(category, { tier: ev.target.value as Tier })
                    }
                    className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
                    data-testid={`tier-select-${category}`}
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-xs text-zinc-700">
                  {sw ? 'Saa za kutendua' : 'Reversal hrs'}
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={e.reversalWindowHours}
                    onChange={(ev) =>
                      onChange(category, {
                        reversalWindowHours:
                          ev.target.value === ''
                            ? ''
                            : Number(ev.target.value),
                      })
                    }
                    className="mt-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col text-xs text-zinc-700">
                  {sw ? 'Kikomo cha pesa' : 'Envelope cap'}
                  <div className="mt-1 flex gap-1">
                    <input
                      type="number"
                      min="0"
                      value={e.envelopeThreshold}
                      onChange={(ev) =>
                        onChange(category, {
                          envelopeThreshold:
                            ev.target.value === ''
                              ? ''
                              : Number(ev.target.value),
                        })
                      }
                      className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
                    />
                    <select
                      value={e.envelopeThresholdCurrency}
                      onChange={(ev) =>
                        onChange(category, {
                          envelopeThresholdCurrency: ev.target.value,
                        })
                      }
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
                <div className="flex items-end gap-1">
                  <button
                    type="button"
                    onClick={() => void onSave(category)}
                    disabled={!e.dirty}
                    className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                    data-testid={`save-${category}`}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {sw ? 'Hifadhi' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReset(category)}
                    disabled={!e.dirty}
                    className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {sw ? 'Rejesha' : 'Reset'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
