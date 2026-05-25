/**
 * UnitCreatePage — second step of the owner-portal property setup journey.
 *
 * POST /api/v1/units (services/api-gateway/src/routes/units.ts).
 * Schema mirrors UnitCreateSchema there: propertyId + unitNumber required.
 *
 * Accepts ?propertyId=<id> URL param to pre-select the parent property
 * when navigated from PropertyDetailPage.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Home, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useProperties } from '../lib/hooks';

interface UnitCreateForm {
  readonly propertyId: string;
  readonly unitNumber: string;
  readonly type: string;
  readonly bedrooms: string;
  readonly bathrooms: string;
  readonly rentAmount: string;
}

const INITIAL_FORM: UnitCreateForm = {
  propertyId: '',
  unitNumber: '',
  type: 'APARTMENT',
  bedrooms: '1',
  bathrooms: '1',
  rentAmount: '0',
};

export function UnitCreatePage(): JSX.Element {
  const t = useTranslations('unitCreatePage');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search] = useSearchParams();
  const presetPropertyId = search.get('propertyId') ?? '';
  const { data: properties = [], isLoading: propertiesLoading } = useProperties();

  const [form, setForm] = useState<UnitCreateForm>({
    ...INITIAL_FORM,
    propertyId: presetPropertyId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presetPropertyId && form.propertyId !== presetPropertyId) {
      setForm((prev) => ({ ...prev, propertyId: presetPropertyId }));
    }
  }, [presetPropertyId, form.propertyId]);

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ id: p.id, label: p.name })),
    [properties]
  );

  function update<K extends keyof UnitCreateForm>(
    key: K,
    value: UnitCreateForm[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form.propertyId) {
      setError(t('errors.propertyRequired'));
      return;
    }
    if (!form.unitNumber.trim()) {
      setError(t('errors.unitNumberRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const body = {
      propertyId: form.propertyId,
      unitNumber: form.unitNumber.trim(),
      type: form.type,
      bedrooms: Number.parseInt(form.bedrooms, 10) || 0,
      bathrooms: Number.parseFloat(form.bathrooms) || 0,
      rentAmount: Number.parseFloat(form.rentAmount) || 0,
    };
    const res = await api.post<{ id: string }>('/units', body);
    setSubmitting(false);
    if (res.success && res.data?.id) {
      await qc.invalidateQueries({ queryKey: ['properties', form.propertyId] });
      navigate(`/properties/${form.propertyId}`);
      return;
    }
    setError(res.error?.message ?? t('errors.createFailed'));
  }

  if (propertiesLoading) {
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
          to={presetPropertyId ? `/properties/${presetPropertyId}` : '/properties'}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={t('back')}
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div className="flex items-center gap-3">
          <Home className="h-6 w-6 text-blue-600" />
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
          <label htmlFor="unit-property" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.property')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <select
            id="unit-property"
            value={form.propertyId}
            onChange={(e) => update('propertyId', e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{t('selectProperty')}</option>
            {propertyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {propertyOptions.length === 0 && (
            <p className="mt-1 text-xs text-yellow-700">
              {t('noPropertiesHint')}{' '}
              <Link to="/properties/new" className="underline">
                {t('createPropertyLink')}
              </Link>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="unit-number" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.unitNumber')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="unit-number"
            type="text"
            value={form.unitNumber}
            onChange={(e) => update('unitNumber', e.target.value)}
            required
            maxLength={50}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="unit-type" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.type')}
          </label>
          <select
            id="unit-type"
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="APARTMENT">{t('typeOptions.apartment')}</option>
            <option value="STUDIO">{t('typeOptions.studio')}</option>
            <option value="HOUSE">{t('typeOptions.house')}</option>
            <option value="OFFICE">{t('typeOptions.office')}</option>
            <option value="RETAIL">{t('typeOptions.retail')}</option>
            <option value="OTHER">{t('typeOptions.other')}</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="unit-bedrooms" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.bedrooms')}
            </label>
            <input
              id="unit-bedrooms"
              type="number"
              min={0}
              value={form.bedrooms}
              onChange={(e) => update('bedrooms', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="unit-bathrooms" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.bathrooms')}
            </label>
            <input
              id="unit-bathrooms"
              type="number"
              min={0}
              step={0.5}
              value={form.bathrooms}
              onChange={(e) => update('bathrooms', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="unit-rent" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.rentAmount')}
            </label>
            <input
              id="unit-rent"
              type="number"
              min={0}
              step={0.01}
              value={form.rentAmount}
              onChange={(e) => update('rentAmount', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
            {t('submit')}
          </Button>
          <Link
            to={presetPropertyId ? `/properties/${presetPropertyId}` : '/properties'}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}

export default UnitCreatePage;
