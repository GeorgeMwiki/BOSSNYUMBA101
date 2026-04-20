/**
 * Data Privacy page — GDPR right-to-be-forgotten — Wave 15 UI gap closure.
 *
 * Provides two actions against /api/v1/gdpr:
 *   1. lodge a deletion request (POST /gdpr/delete-request)
 *   2. poll for an existing request status (GET /gdpr/delete-request/:id)
 *
 * Super-admin execution (POST .../execute) is gated server-side — the
 * button only appears if the caller role allows it, but the server is
 * the authority.
 */

import React, { useCallback, useState } from 'react';
import { Lock, Shield, Download, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface DeleteRequestRecord {
  readonly id: string;
  readonly customerId: string;
  readonly status: string;
  readonly createdAt: string;
  readonly executedAt?: string | null;
  readonly notes?: string;
}

export default function DataPrivacy(): JSX.Element {
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [record, setRecord] = useState<DeleteRequestRecord | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const res = await api.post<DeleteRequestRecord>('/gdpr/delete-request', {
      customerId,
      notes: notes || undefined,
    });
    setLoading(false);
    if (res.success && res.data) {
      setRecord(res.data);
      setMessage(`Request ${res.data.id} recorded (status: ${res.data.status}).`);
    } else {
      setError(res.error ?? 'Request failed.');
    }
  }, [customerId, notes]);

  const lookup = useCallback(async () => {
    if (!lookupId) return;
    setLoading(true);
    setError(null);
    const res = await api.get<DeleteRequestRecord>(
      `/gdpr/delete-request/${encodeURIComponent(lookupId)}`,
    );
    setLoading(false);
    if (res.success && res.data) {
      setRecord(res.data);
    } else {
      setError(res.error ?? 'Lookup failed.');
    }
  }, [lookupId]);

  const execute = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    setError(null);
    const res = await api.post<DeleteRequestRecord>(
      `/gdpr/delete-request/${encodeURIComponent(record.id)}/execute`,
      {},
    );
    setLoading(false);
    if (res.success && res.data) {
      setRecord(res.data);
      setMessage('Deletion executed.');
    } else {
      setError(res.error ?? 'Execute failed.');
    }
  }, [record]);

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <Lock className="h-6 w-6 text-rose-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Data privacy</h2>
          <p className="text-sm text-gray-500">
            GDPR-aligned subject requests. Every action is audited.
          </p>
        </div>
      </header>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5" /> {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-rose-500" />
          <h3 className="font-semibold text-gray-900">New deletion request</h3>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700">Customer ID</span>
          <input
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="cust_…"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            data-testid="gdpr-customer-id"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!customerId || loading}
          className="rounded bg-rose-600 text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          ) : null}
          Submit deletion request
        </button>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-indigo-500" />
          <h3 className="font-semibold text-gray-900">Look up a request</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            placeholder="Request ID"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={!lookupId || loading}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Fetch status
          </button>
        </div>
      </section>

      {record && (
        <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-2">
          <p className="font-semibold text-gray-900">Request {record.id}</p>
          <p className="text-gray-600">Customer: {record.customerId}</p>
          <p className="text-gray-600">Status: {record.status}</p>
          <p className="text-gray-600">Created: {record.createdAt}</p>
          {record.executedAt && (
            <p className="text-gray-600">Executed: {record.executedAt}</p>
          )}
          {record.notes && <p className="text-gray-600">Notes: {record.notes}</p>}
          {record.status !== 'executed' && (
            <button
              type="button"
              onClick={() => void execute()}
              className="rounded bg-red-600 text-white px-4 py-2 text-sm mt-2"
            >
              Execute deletion (super-admin)
            </button>
          )}
        </section>
      )}
    </div>
  );
}
