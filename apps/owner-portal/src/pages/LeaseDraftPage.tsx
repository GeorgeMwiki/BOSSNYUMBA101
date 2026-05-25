/**
 * LeaseDraftPage — third step of the owner-portal property setup journey.
 *
 * POST /api/v1/leases (services/api-gateway/src/routes/leases.ts).
 * Schema mirrors CreateLeaseSchema there: unitId + customerId + startDate +
 * endDate + rentAmount required. New leases land in draft state — the
 * activate endpoint (`/leases/:id/activate`) promotes them to ACTIVE.
 *
 * Accepts ?unitId=<id> URL param to pre-select the target unit when
 * navigated from PropertyDetailPage's unit list.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface CustomerOption {
  readonly id: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
}

interface UnitOption {
  readonly id: string;
  readonly unitNumber: string;
  readonly propertyId?: string;
  readonly rentAmount?: number;
}

interface LeaseDraftForm {
  readonly unitId: string;
  readonly customerId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly rentAmount: string;
  readonly depositAmount: string;
}

function defaultEndDate(start: string): string {
  if (!start) return '';
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export function LeaseDraftPage(): JSX.Element {
  const t = useTranslations('leaseDraftPage');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search] = useSearchParams();
  const presetUnitId = search.get('unitId') ?? '';

  const [customers, setCustomers] = useState<readonly CustomerOption[]>([]);
  const [units, setUnits] = useState<readonly UnitOption[]>([]);
  const [refsLoading, setRefsLoading] = useState(true);

  const initialStart = todayIso();
  const [form, setForm] = useState<LeaseDraftForm>({
    unitId: presetUnitId,
    customerId: '',
    startDate: initialStart,
    endDate: defaultEndDate(initialStart),
    rentAmount: '0',
    depositAmount: '0',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const [unitsRes, customersRes] = await Promise.all([
        api.get<readonly UnitOption[]>('/units'),
        api.get<readonly CustomerOption[]>('/customers'),
      ]);
      if (cancelled) return;
      if (unitsRes.success && unitsRes.data) setUnits(unitsRes.data);
      if (customersRes.success && customersRes.data) setCustomers(customersRes.data);
      setRefsLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // When unit changes, snap the rent default to that unit's rentAmount if known.
  useEffect(() => {
    const u = units.find((unit) => unit.id === form.unitId);
    if (u?.rentAmount !== undefined && form.rentAmount === '0') {
      setForm((prev) => ({ ...prev, rentAmount: String(u.rentAmount) }));
    }
  }, [form.unitId, form.rentAmount, units]);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        id: c.id,
        label: [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email || c.id,
      })),
    [customers]
  );

  const unitOptions = useMemo(
    () => units.map((u) => ({ id: u.id, label: `Unit ${u.unitNumber}` })),
    [units]
  );

  function update<K extends keyof LeaseDraftForm>(
    key: K,
    value: LeaseDraftForm[K]
  ): void {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'startDate' && (!prev.endDate || prev.endDate < value)) {
        next.endDate = defaultEndDate(value);
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form.unitId) {
      setError(t('errors.unitRequired'));
      return;
    }
    if (!form.customerId) {
      setError(t('errors.tenantRequired'));
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError(t('errors.endBeforeStart'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const body = {
      unitId: form.unitId,
      customerId: form.customerId,
      startDate: form.startDate,
      endDate: form.endDate,
      rentAmount: Number.parseFloat(form.rentAmount) || 0,
      depositAmount: Number.parseFloat(form.depositAmount) || 0,
    };
    const res = await api.post<{ id: string }>('/leases', body);
    setSubmitting(false);
    if (res.success && res.data?.id) {
      await qc.invalidateQueries({ queryKey: ['leases'] });
      navigate('/properties');
      return;
    }
    setError(res.error?.message ?? t('errors.createFailed'));
  }

  if (refsLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          to="/properties"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-gray-200 p-6">
        <div>
          <label htmlFor="lease-unit" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.unit')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <select
            id="lease-unit"
            value={form.unitId}
            onChange={(e) => update('unitId', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('selectUnit')}</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          {unitOptions.length === 0 && (
            <p className="mt-1 text-xs text-yellow-700">
              {t('noUnitsHint')}{' '}
              <Link to="/units/new" className="underline">
                {t('createUnitLink')}
              </Link>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lease-tenant" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.tenant')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <select
            id="lease-tenant"
            value={form.customerId}
            onChange={(e) => update('customerId', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('selectTenant')}</option>
            {customerOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lease-start" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.startDate')}
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <input
              id="lease-start"
              type="date"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="lease-end" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.endDate')}
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <input
              id="lease-end"
              type="date"
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
              required
              min={form.startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="lease-rent" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.rentAmount')}
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            </label>
            <input
              id="lease-rent"
              type="number"
              min={0}
              step={0.01}
              value={form.rentAmount}
              onChange={(e) => update('rentAmount', e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="lease-deposit" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.depositAmount')}
            </label>
            <input
              id="lease-deposit"
              type="number"
              min={0}
              step={0.01}
              value={form.depositAmount}
              onChange={(e) => update('depositAmount', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">{t('draftHint')}</p>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
            {t('submit')}
          </Button>
          <Link
            to="/properties"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}

export default LeaseDraftPage;
