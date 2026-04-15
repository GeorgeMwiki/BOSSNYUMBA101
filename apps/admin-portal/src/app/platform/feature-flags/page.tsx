/**
 * FeatureFlagsPage — platform-wide feature flag registry.
 *
 * Assumed backend endpoints:
 *   GET   /platform/feature-flags
 *         -> { data: { flags: FeatureFlag[] } }
 *   PATCH /platform/feature-flags/:key   (body: { enabled: boolean })
 *         -> { data: FeatureFlag }
 *
 * The api client normalizes responses to { success, data, error }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Flag,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api, formatDateTime } from '../../../lib/api';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  environment: 'production' | 'staging' | 'development' | string;
  owner: string;
  updatedAt: string;
}

interface FeatureFlagsResponse {
  flags: FeatureFlag[];
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchFlags = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<FeatureFlagsResponse>('/platform/feature-flags')
      .then((res) => {
        if (res.success && res.data) {
          setFlags(res.data.flags);
        } else {
          setError(res.error ?? 'Failed to load feature flags.');
          setFlags([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (flag: FeatureFlag) => {
    const next = !flag.enabled;
    setTogglingKey(flag.key);
    // Optimistic update
    setFlags((prev) =>
      prev.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f))
    );
    const res = await api.patch<FeatureFlag>(
      `/platform/feature-flags/${encodeURIComponent(flag.key)}`,
      { enabled: next }
    );
    setTogglingKey(null);
    if (!res.success) {
      // Rollback
      setFlags((prev) =>
        prev.map((f) => (f.key === flag.key ? { ...f, enabled: flag.enabled } : f))
      );
      setError(res.error ?? 'Failed to update flag.');
    } else if (res.data) {
      setFlags((prev) => prev.map((f) => (f.key === flag.key ? res.data! : f)));
    }
  };

  const filtered = flags.filter((f) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      f.key.toLowerCase().includes(q) ||
      f.name.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="text-sm text-gray-500 mt-1">
            {flags.length.toLocaleString()} registered flag{flags.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchFlags}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <label htmlFor="flag-search" className="sr-only">
          Search flags
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="flag-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by key, name, or description"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchFlags}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Flag className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">
            {flags.length === 0 ? 'No feature flags yet.' : 'No flags match your search.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((flag) => (
            <li
              key={flag.key}
              className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{flag.name}</h3>
                  <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                    {flag.key}
                  </code>
                  <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded capitalize">
                    {flag.environment}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{flag.description}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Owner: {flag.owner} &middot; Updated {formatDateTime(flag.updatedAt)}
                </p>
              </div>
              <ToggleSwitch
                checked={flag.enabled}
                disabled={togglingKey === flag.key}
                onChange={() => handleToggle(flag)}
                label={`Toggle ${flag.name}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}

function ToggleSwitch({ checked, disabled, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-violet-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
