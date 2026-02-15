import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  ArrowRight,
  Briefcase,
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

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<Vendor[]>('/vendors').then((res) => {
      if (res.success && res.data) {
        setVendors(res.data);
      }
      setLoading(false);
    });
  }, []);

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const displayVendors = filtered.length ? filtered : [
    { id: '1', name: 'QuickFix Plumbing', type: 'Plumbing', email: 'contact@quickfix.co.ke', phone: '+254 700 123 456', status: 'ACTIVE', propertiesCount: 3 },
    { id: '2', name: 'SafeElectric Ltd', type: 'Electrical', email: 'info@safeelectric.co.ke', phone: '+254 722 987 654', status: 'ACTIVE', propertiesCount: 2 },
    { id: '3', name: 'CleanPro Services', type: 'Cleaning', email: 'hello@cleanpro.co.ke', phone: '+254 733 456 789', status: 'ACTIVE', propertiesCount: 3 },
  ];

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
              {displayVendors.map((vendor) => (
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
    </div>
  );
}
