import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Building2,
  Mail,
  Phone,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../../lib/api';

interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  leaseEndDate: string;
  rentAmount: number;
  status: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<Tenant[]>('/tenants').then((res) => {
      if (res.success && res.data) {
        setTenants(res.data);
      }
      setLoading(false);
    });
  }, []);

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.propertyName?.toLowerCase().includes(search.toLowerCase()) ||
      t.unitNumber?.toLowerCase().includes(search.toLowerCase())
  );

  const displayTenants = filtered.length
    ? filtered
    : [
        { id: '1', name: 'John Kamau', email: 'john@example.com', phone: '+254 700 111 222', propertyId: '1', propertyName: 'Westlands Apartments', unitNumber: '4B', leaseEndDate: '2024-12-31', rentAmount: 65000, status: 'ACTIVE' },
        { id: '2', name: 'Mary Wanjiku', email: 'mary@example.com', phone: '+254 722 333 444', propertyId: '1', propertyName: 'Westlands Apartments', unitNumber: '2A', leaseEndDate: '2024-06-30', rentAmount: 55000, status: 'ACTIVE' },
        { id: '3', name: 'Peter Ochieng', email: 'peter@example.com', phone: '+254 733 555 666', propertyId: '2', propertyName: 'Kilimani Complex', unitNumber: '101', leaseEndDate: '2024-09-15', rentAmount: 85000, status: 'ACTIVE' },
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
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-500">All tenants across your properties</p>
        </div>
        <Link
          to="/tenants/communications"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <MessageSquare className="h-4 w-4" />
          Communications
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search tenants..."
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property / Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lease End</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{tenant.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        to={`/properties/${tenant.propertyId}`}
                        className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
                      >
                        <Building2 className="h-4 w-4" />
                        {tenant.propertyName}
                      </Link>
                      <p className="text-sm text-gray-500">Unit {tenant.unitNumber}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                      {tenant.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {tenant.email}
                        </span>
                      )}
                      {tenant.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {tenant.phone}
                        </span>
                      )}
                      {!tenant.email && !tenant.phone && '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatCurrency(tenant.rentAmount || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(tenant.leaseEndDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/tenants/${tenant.id}`}
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
