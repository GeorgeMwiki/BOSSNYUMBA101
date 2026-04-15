/**
 * TenantDetailPage — full profile for a single tenant.
 *
 * Assumed backend endpoints:
 *   GET    /tenants/:id
 *          -> { data: TenantDetail }
 *   PATCH  /tenants/:id                   (body: Partial<TenantDetail>)
 *   POST   /tenants/:id/suspend           (body: { reason: string })
 *
 * Route: /tenants/:id (react-router v6 param).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  PauseCircle,
  RefreshCw,
  Save,
} from 'lucide-react';
import { api, formatDate, formatCurrency } from '../lib/api';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  ownerEmail: string;
  ownerName: string;
  userCount: number;
  unitCount: number;
  propertyCount: number;
  mrr: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchTenant = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .get<TenantDetail>(`/tenants/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setTenant(res.data);
          setNotes(res.data.notes ?? '');
        } else {
          setError(res.error ?? 'Failed to load tenant.');
          setTenant(null);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const res = await api.patch<TenantDetail>(`/tenants/${id}`, { notes });
    setSaving(false);
    if (res.success && res.data) {
      setTenant(res.data);
    } else {
      setError(res.error ?? 'Failed to save.');
    }
  };

  const handleSuspend = async () => {
    if (!id || !tenant) return;
    const reason = window.prompt(`Suspend ${tenant.name}? Enter reason:`);
    if (!reason) return;
    const res = await api.post(`/tenants/${id}/suspend`, { reason });
    if (res.success) {
      fetchTenant();
    } else {
      setError(res.error ?? 'Failed to suspend tenant.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-gray-600">{error ?? 'Tenant not found.'}</p>
        <button
          type="button"
          onClick={fetchTenant}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/tenants"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Back to tenants"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Building2 className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
              <p className="text-sm text-gray-500">
                {tenant.slug} &middot; {tenant.plan} &middot;{' '}
                <span className="capitalize">{tenant.status}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchTenant}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleSuspend}
            disabled={tenant.status === 'suspended'}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <PauseCircle className="h-4 w-4" />
            {tenant.status === 'suspended' ? 'Suspended' : 'Suspend'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Users" value={tenant.userCount.toLocaleString()} />
        <StatCard label="Properties" value={tenant.propertyCount.toLocaleString()} />
        <StatCard label="Units" value={tenant.unitCount.toLocaleString()} />
        <StatCard label="MRR" value={formatCurrency(tenant.mrr)} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Owner</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-900 font-medium">{tenant.ownerName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900 font-medium">{tenant.ownerEmail}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900 font-medium">{formatDate(tenant.createdAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <label htmlFor="tenant-notes" className="block font-semibold text-gray-900">
          Internal notes
        </label>
        <textarea
          id="tenant-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="Context for support and CSM teams"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default TenantDetailPage;
