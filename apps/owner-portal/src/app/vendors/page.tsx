import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  ArrowRight,
  Briefcase,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';

interface Vendor {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  status: string;
  propertiesCount?: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-28 bg-gray-200 rounded" />
          <div className="h-4 w-56 bg-gray-200 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-10 w-full max-w-md bg-gray-200 rounded-lg" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-9 h-9 bg-gray-200 rounded-lg" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
              <div className="w-16 h-4 bg-gray-200 rounded" />
              <div className="w-24 h-4 bg-gray-200 rounded" />
              <div className="w-16 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Vendor[]>('/vendors');
      if (res.success && res.data) {
        setVendors(res.data);
      } else {
        const errMsg = res.error && typeof res.error === 'object' ? res.error.message : 'Failed to load vendors';
        setError(errMsg);
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to Load Vendors</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchVendors}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-500">Manage your property service providers</p>
        </div>
        <Link
          to="/vendors/contracts"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <Briefcase className="h-4 w-4" />
          View Contracts
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Properties</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{vendor.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                        {vendor.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-sm text-gray-600">
                        {vendor.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {vendor.email}
                          </span>
                        )}
                        {vendor.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {vendor.phone}
                          </span>
                        )}
                        {!vendor.email && !vendor.phone && '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {vendor.propertiesCount || 0} properties
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          vendor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/vendors/${vendor.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        View <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Vendors Yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            Add your first vendor to start managing property service providers.
          </p>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No vendors match your search
        </div>
      )}
    </div>
  );
}
