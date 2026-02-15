import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';
import { api, formatDate } from '../../lib/api';

export default function CompliancePage() {
  const [stats, setStats] = useState<{
    compliant: number;
    expiringSoon: number;
    overdue: number;
    totalItems: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/compliance/summary').then((res) => {
      if (res.success && res.data) {
        setStats(res.data as typeof stats);
      }
      setLoading(false);
    });
  }, []);

  const displayStats = stats || {
    compliant: 12,
    expiringSoon: 3,
    overdue: 1,
    totalItems: 16,
  };

  const recentItems = [
    { type: 'license', name: 'Rental License - Westlands', status: 'EXPIRING_SOON', date: '2024-03-15' },
    { type: 'insurance', name: 'Property Insurance', status: 'COMPLIANT', date: '2024-12-31' },
    { type: 'inspection', name: 'Fire Safety Inspection', status: 'DUE', date: '2024-02-28' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

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
      </div>
    </div>
  );
}
