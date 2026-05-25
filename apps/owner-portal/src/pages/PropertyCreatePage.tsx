/**
 * PropertyCreatePage — closes the "owners cannot create their first property
 * from the owner-portal" journey block surfaced in the P91 UI audit.
 *
 * POST /api/v1/properties (handled by services/api-gateway/src/routes/properties.ts).
 * Schema mirrors PropertyCreateSchema there: name required, address fields optional.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface PropertyCreateForm {
  readonly name: string;
  readonly type: string;
  readonly addressLine1: string;
  readonly city: string;
  readonly region: string;
  readonly country: string;
  readonly totalUnits: string;
}

const INITIAL_FORM: PropertyCreateForm = {
  name: '',
  type: 'RESIDENTIAL',
  addressLine1: '',
  city: '',
  region: '',
  country: '',
  totalUnits: '0',
};

export function PropertyCreatePage(): JSX.Element {
  const t = useTranslations('propertyCreatePage');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<PropertyCreateForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof PropertyCreateForm>(
    key: K,
    value: PropertyCreateForm[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form.name.trim()) {
      setError(t('errors.nameRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const totalUnitsParsed = Number.parseInt(form.totalUnits, 10);
    const body = {
      name: form.name.trim(),
      type: form.type,
      address: {
        line1: form.addressLine1.trim() || undefined,
        city: form.city.trim() || undefined,
        region: form.region.trim() || undefined,
        country: form.country.trim() || undefined,
      },
      totalUnits: Number.isFinite(totalUnitsParsed) && totalUnitsParsed >= 0
        ? totalUnitsParsed
        : 0,
    };
    const res = await api.post<{ id: string }>('/properties', body);
    setSubmitting(false);
    if (res.success && res.data?.id) {
      await qc.invalidateQueries({ queryKey: ['properties'] });
      navigate(`/properties/${res.data.id}`);
      return;
    }
    setError(res.error?.message ?? t('errors.createFailed'));
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
          <Building2 className="h-6 w-6 text-blue-600" />
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
          <label htmlFor="property-name" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.name')}
            <span className="text-red-500 ml-1" aria-hidden="true">*</span>
          </label>
          <input
            id="property-name"
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="property-type" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.type')}
          </label>
          <select
            id="property-type"
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="RESIDENTIAL">{t('typeOptions.residential')}</option>
            <option value="COMMERCIAL">{t('typeOptions.commercial')}</option>
            <option value="MIXED_USE">{t('typeOptions.mixedUse')}</option>
            <option value="OTHER">{t('typeOptions.other')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="property-address" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.address')}
          </label>
          <input
            id="property-address"
            type="text"
            value={form.addressLine1}
            onChange={(e) => update('addressLine1', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="property-city" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.city')}
            </label>
            <input
              id="property-city"
              type="text"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="property-region" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.region')}
            </label>
            <input
              id="property-region"
              type="text"
              value={form.region}
              onChange={(e) => update('region', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="property-country" className="block text-sm font-medium text-gray-700 mb-1">
              {t('fields.country')}
            </label>
            <input
              id="property-country"
              type="text"
              value={form.country}
              onChange={(e) => update('country', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="property-units" className="block text-sm font-medium text-gray-700 mb-1">
            {t('fields.totalUnits')}
          </label>
          <input
            id="property-units"
            type="number"
            min={0}
            value={form.totalUnits}
            onChange={(e) => update('totalUnits', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">{t('hints.totalUnits')}</p>
        </div>

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

export default PropertyCreatePage;
