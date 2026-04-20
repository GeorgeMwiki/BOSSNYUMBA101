/**
 * Feature Flags admin page — Wave 15 UI gap closure.
 *
 * GET /api/v1/feature-flags for the resolved flag list, PUT to toggle
 * a single flag for the caller's tenant. No hardcoded list — everything
 * renders from whatever the server returns.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Flag, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../lib/api';

interface FeatureFlag {
  readonly key: string;
  readonly name?: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly scope?: string;
  readonly updatedAt?: string;
}

export default function FeatureFlagsPage(): JSX.Element {
  const [flags, setFlags] = useState<readonly FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<readonly FeatureFlag[]>('/feature-flags');
    if (res.success && res.data) {
      setFlags(res.data);
    } else {
      setError(res.error ?? 'Unable to load feature flags.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(flag: FeatureFlag): Promise<void> {
    setSaving(flag.key);
    const next = { ...flag, enabled: !flag.enabled };
    const res = await api.put(`/feature-flags/${encodeURIComponent(flag.key)}`, {
      enabled: next.enabled,
    });
    setSaving(null);
    if (res.success) {
      setFlags((prev) =>
        prev.map((f) => (f.key === flag.key ? { ...f, enabled: next.enabled } : f)),
      );
    } else {
      setError(res.error ?? 'Unable to update flag.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Flag className="h-6 w-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Feature flags</h2>
          <p className="text-sm text-gray-500">
            Toggle optional features for this tenant.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && flags.length === 0 && !error && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500">
          No feature flags registered for this tenant.
        </div>
      )}

      {!loading && flags.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {flags.map((flag) => (
              <li key={flag.key} className="flex items-start gap-4 p-4">
                <div className="mt-1">
                  {flag.enabled ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {flag.name ?? flag.key}
                    </p>
                    <code className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                      {flag.key}
                    </code>
                    {flag.scope && (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {flag.scope}
                      </span>
                    )}
                  </div>
                  {flag.description && (
                    <p className="text-sm text-gray-500 mt-1">{flag.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void toggle(flag)}
                  disabled={saving === flag.key}
                  aria-pressed={flag.enabled}
                  aria-label={`Toggle ${flag.key}`}
                  data-testid={`flag-${flag.key}`}
                  className={`w-12 h-6 rounded-full transition flex items-center p-1 ${
                    flag.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                  } ${saving === flag.key ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                      flag.enabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
