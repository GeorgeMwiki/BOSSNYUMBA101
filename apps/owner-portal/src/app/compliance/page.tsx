import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api, formatDate } from '../../lib/api';

interface ComplianceStats {
  compliant: number;
  expiringSoon: number;
  overdue: number;
  totalItems: number;
}

interface ComplianceItem {
  type: string;
  name: string;
  status: 'COMPLIANT' | 'EXPIRING_SOON' | 'DUE';
  date: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-52 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-200 rounded mt-2" />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-28 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
            <div className="h-7 w-8 bg-gray-200 rounded mt-3" />
            <div className="h-4 w-24 bg-gray-200 rounded mt-1" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 bg-gray-200 rounded-lg" />
                <div>
                  <div className="h-5 w-48 bg-gray-200 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded mt-1" />
                </div>
              </div>
              <div className="h-6 w-24 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [recentItems, setRecentItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComplianceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, itemsRes] = await Promise.all([
        api.get<ComplianceStats>('/compliance/summary'),
        api.get<ComplianceItem[]>('/compliance/items'),
      ]);

      if (summaryRes.success && summaryRes.data) {
        setStats(summaryRes.data);
      }
      if (itemsRes.success && itemsRes.data) {
        setRecentItems(itemsRes.data);
      }

      if (!summaryRes.success && !itemsRes.success) {
        const errMsg = summaryRes.error && typeof summaryRes.error === 'object'
          ? summaryRes.error.message
          : 'Failed to load compliance data';
        setError(errMsg);
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to Load Compliance Data</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchComplianceData}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const displayStats = stats || { compliant: 0, expiringSoon: 0, overdue: 0, totalItems: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
          <p className="text-gray-500">Property compliance and regulatory tracking</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/compliance/licenses"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <FileCheck className="h-4 w-4" />
            Licenses
          </Link>
          <Link
            to="/compliance/insurance"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <Shield className="h-4 w-4" />
            Insurance
          </Link>
          <Link
            to="/compliance/inspections"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <ClipboardList className="h-4 w-4" />
            Inspections
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Compliant</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.compliant}</p>
          <p className="text-sm text-gray-500">items up to date</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Expiring Soon</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.expiringSoon}</p>
          <Link to="/compliance/licenses" className="text-sm text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
            Review <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Overdue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.overdue}</p>
          <p className="text-sm text-gray-500">requires attention</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Items</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayStats.totalItems}</p>
          <p className="text-sm text-gray-500">tracked</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Requires Attention</h3>
        {recentItems.length > 0 ? (
          <div className="space-y-4">
            {recentItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      item.status === 'COMPLIANT' ? 'bg-green-100' :
                      item.status === 'EXPIRING_SOON' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}
                  >
                    <FileCheck
                      className={`h-5 w-5 ${
                        item.status === 'COMPLIANT' ? 'text-green-600' :
                        item.status === 'EXPIRING_SOON' ? 'text-yellow-600' : 'text-red-600'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.status === 'COMPLIANT' ? 'Valid until' : item.status === 'EXPIRING_SOON' ? 'Expires' : 'Due'}{' '}
                      {formatDate(item.date)}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    item.status === 'COMPLIANT' ? 'bg-green-100 text-green-700' :
                    item.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {item.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No Compliance Items</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Compliance items such as licenses, insurance, and inspections will appear here once tracked.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
