/**
 * IoT sensor registry + anomaly inbox — Wave 15 UI gap closure.
 *
 *   GET  /api/v1/iot/sensors
 *   GET  /api/v1/iot/anomalies
 *   POST /api/v1/iot/anomalies/:id/acknowledge
 *   POST /api/v1/iot/anomalies/:id/resolve
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Radio, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface Sensor {
  readonly id: string;
  readonly kind: string;
  readonly externalId: string;
  readonly vendor: string;
  readonly unitId?: string;
  readonly label?: string;
  readonly lastObservedAt?: string;
}

interface Anomaly {
  readonly id: string;
  readonly sensorId: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly description: string;
  readonly observedAt: string;
  readonly acknowledgedAt?: string | null;
  readonly resolvedAt?: string | null;
}

export default function IotSensors(): JSX.Element {
  const [sensors, setSensors] = useState<readonly Sensor[]>([]);
  const [anomalies, setAnomalies] = useState<readonly Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'sensors' | 'anomalies'>('anomalies');

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a] = await Promise.all([
      api.get<readonly Sensor[]>('/iot/sensors'),
      api.get<readonly Anomaly[]>('/iot/anomalies?unresolved=true'),
    ]);
    if (s.success && s.data) setSensors(s.data);
    else setError(s.error ?? 'Unable to load sensors.');
    if (a.success && a.data) setAnomalies(a.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ack(id: string): Promise<void> {
    await api.post(`/iot/anomalies/${encodeURIComponent(id)}/acknowledge`, {});
    void load();
  }
  async function resolve(id: string): Promise<void> {
    await api.post(`/iot/anomalies/${encodeURIComponent(id)}/resolve`, {});
    void load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-cyan-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">IoT sensors</h2>
          <p className="text-sm text-gray-500">Registered devices and open anomalies.</p>
        </div>
      </header>

      <nav className="flex gap-2 border-b border-gray-200">
        {(['anomalies', 'sensors'] as const).map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px ${
              tab === key
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {key}
            {key === 'anomalies' && anomalies.length > 0 ? ` (${anomalies.length})` : ''}
          </button>
        ))}
      </nav>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && tab === 'anomalies' && (
        <ul className="space-y-2">
          {anomalies.length === 0 ? (
            <li className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              No open anomalies — all sensors nominal.
            </li>
          ) : (
            anomalies.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border p-4 text-sm ${
                  a.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : a.severity === 'warning'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {a.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Sensor {a.sensorId} · {new Date(a.observedAt).toLocaleString()} ·{' '}
                      {a.severity}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!a.acknowledgedAt && (
                      <button
                        type="button"
                        onClick={() => void ack(a.id)}
                        className="rounded border border-gray-300 bg-white px-3 py-1 text-xs"
                      >
                        Acknowledge
                      </button>
                    )}
                    {!a.resolvedAt && (
                      <button
                        type="button"
                        onClick={() => void resolve(a.id)}
                        className="rounded bg-cyan-600 text-white px-3 py-1 text-xs"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {!loading && tab === 'sensors' && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {sensors.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No sensors registered.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">External ID</th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Last obs.</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{s.kind}</td>
                    <td className="px-3 py-2 font-mono text-xs">{s.externalId}</td>
                    <td className="px-3 py-2">{s.vendor}</td>
                    <td className="px-3 py-2">{s.unitId ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {s.lastObservedAt
                        ? new Date(s.lastObservedAt).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
