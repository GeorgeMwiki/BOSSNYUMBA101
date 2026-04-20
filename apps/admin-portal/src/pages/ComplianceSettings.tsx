/**
 * Compliance plugin settings — Wave 15 UI gap closure.
 *
 * Reads `/api/v1/compliance-plugins` and lets the admin see the active
 * country plugin plus every registered plugin. The registry is read-only
 * on the server; the country itself is switched through
 * `/configuration` — this page just exposes what compliance rules apply
 * today.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Globe2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface KycProvider {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}

interface PaymentGateway {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}

interface CountryPlugin {
  readonly countryCode: string;
  readonly countryName: string;
  readonly currencyCode: string;
  readonly currencySymbol: string;
  readonly phoneCountryCode: string;
  readonly kycProviders: readonly KycProvider[];
  readonly paymentGateways: readonly PaymentGateway[];
  readonly compliance: {
    readonly minDepositMonths: number;
    readonly maxDepositMonths: number;
    readonly noticePeriodDays: number;
    readonly minimumLeaseMonths: number;
    readonly subleaseConsent: string;
    readonly lateFeeCapRate: number;
    readonly depositReturnDays: number;
  };
}

interface PluginCatalog {
  readonly defaultCountryCode: string;
  readonly count: number;
  readonly countries: readonly CountryPlugin[];
}

export default function ComplianceSettings(): JSX.Element {
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<PluginCatalog>('/compliance-plugins').then((res) => {
      if (!active) return;
      if (res.success && res.data) {
        setCatalog(res.data);
        setSelected(res.data.defaultCountryCode);
      } else {
        setError(res.error ?? 'Unable to load compliance catalog.');
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const active = useMemo(() => {
    if (!catalog || !selected) return null;
    return catalog.countries.find((c) => c.countryCode === selected) ?? null;
  }, [catalog, selected]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading compliance plugins…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!catalog) return <p className="text-sm text-gray-500 p-6">No data.</p>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-emerald-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Compliance plugins</h2>
          <p className="text-sm text-gray-500">
            {catalog.count} registered. Active jurisdiction: {catalog.defaultCountryCode}.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {catalog.countries.map((country) => (
          <button
            type="button"
            key={country.countryCode}
            onClick={() => setSelected(country.countryCode)}
            aria-pressed={selected === country.countryCode}
            data-testid={`plugin-${country.countryCode}`}
            className={`text-left rounded-xl border p-4 transition ${
              selected === country.countryCode
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Globe2 className="h-4 w-4" />
              {country.countryCode}
            </div>
            <p className="mt-2 font-semibold text-gray-900">{country.countryName}</p>
            <p className="text-xs text-gray-500">
              {country.currencyCode} {country.currencySymbol} · {country.phoneCountryCode}
            </p>
          </button>
        ))}
      </section>

      {active && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">
            {active.countryName} — compliance profile
          </h3>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Deposit cap</dt>
              <dd>
                {active.compliance.minDepositMonths}–
                {active.compliance.maxDepositMonths} months
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Notice period</dt>
              <dd>{active.compliance.noticePeriodDays} days</dd>
            </div>
            <div>
              <dt className="text-gray-500">Minimum lease</dt>
              <dd>{active.compliance.minimumLeaseMonths} months</dd>
            </div>
            <div>
              <dt className="text-gray-500">Sublease consent</dt>
              <dd>{active.compliance.subleaseConsent}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Late-fee cap</dt>
              <dd>{(active.compliance.lateFeeCapRate * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-gray-500">Deposit return window</dt>
              <dd>{active.compliance.depositReturnDays} days</dd>
            </div>
          </dl>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              KYC providers ({active.kycProviders.length})
            </h4>
            <ul className="flex flex-wrap gap-2 text-xs">
              {active.kycProviders.map((k) => (
                <li
                  key={k.id}
                  className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1"
                >
                  {k.name} ({k.kind})
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Payment gateways ({active.paymentGateways.length})
            </h4>
            <ul className="flex flex-wrap gap-2 text-xs">
              {active.paymentGateways.map((g) => (
                <li
                  key={g.id}
                  className="bg-violet-50 text-violet-800 border border-violet-200 rounded-full px-3 py-1"
                >
                  {g.name} ({g.kind})
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
