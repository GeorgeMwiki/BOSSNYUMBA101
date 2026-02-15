import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Briefcase,
  Calendar,
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../../../lib/api';

interface VendorDetail {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  address?: string;
  status: string;
  properties: Array<{ id: string; name: string }>;
  recentWorkOrders?: Array<{ id: string; description: string; status: string; createdAt: string }>;
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get<VendorDetail>(`/vendors/${id}`).then((res) => {
        if (res.success && res.data) {
          setVendor(res.data);
        }
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const displayVendor = vendor || {
    id: id!,
    name: 'QuickFix Plumbing',
    type: 'Plumbing',
    email: 'contact@quickfix.co.ke',
    phone: '+254 700 123 456',
    address: 'Nairobi, Kenya',
    status: 'ACTIVE',
    properties: [
      { id: '1', name: 'Westlands Apartments' },
      { id: '2', name: 'Kilimani Complex' },
    ],
    recentWorkOrders: [
      { id: '1', description: 'Pipe repair - Unit 4B', status: 'COMPLETED', createdAt: '2024-02-10' },
      { id: '2', description: 'Water heater replacement', status: 'IN_PROGRESS', createdAt: '2024-02-12' },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/vendors"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayVendor.name}</h1>
          <p className="text-gray-500">{displayVendor.type} • {displayVendor.status}</p>
        </div>
        <Link
          to="/vendors/contracts"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <Briefcase className="h-4 w-4" />
          View Contracts
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="space-y-4">
            {displayVendor.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{displayVendor.email}</p>
                </div>
              </div>
            )}
            {displayVendor.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{displayVendor.phone}</p>
                </div>
              </div>
            )}
            {displayVendor.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">{displayVendor.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Associated Properties</h3>
          <div className="space-y-3">
            {displayVendor.properties?.map((prop) => (
              <Link
                key={prop.id}
                to={`/properties/${prop.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">{prop.name}</span>
                </div>
                <span className="text-sm text-blue-600">View</span>
              </Link>
            ))}
            {(!displayVendor.properties || displayVendor.properties.length === 0) && (
              <p className="text-gray-500">No properties assigned</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Work Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayVendor.recentWorkOrders?.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{wo.id}</td>
                  <td className="px-4 py-3 text-gray-600">{wo.description}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        wo.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        wo.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {wo.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(wo.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!displayVendor.recentWorkOrders || displayVendor.recentWorkOrders.length === 0) && (
          <p className="text-center py-8 text-gray-500">No recent work orders</p>
        )}
      </div>
    </div>
  );
}
