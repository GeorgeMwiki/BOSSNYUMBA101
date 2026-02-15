import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Building2,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../../../lib/api';

interface TenantDetail {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  leaseStartDate: string;
  leaseEndDate: string;
  rentAmount: number;
  status: string;
  balance?: number;
  payments?: Array<{ id: string; amount: number; date: string; status: string }>;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get<TenantDetail>(`/tenants/${id}`).then((res) => {
        if (res.success && res.data) {
          setTenant(res.data);
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

  const displayTenant = tenant || {
    id: id!,
    name: 'John Kamau',
    email: 'john@example.com',
    phone: '+254 700 111 222',
    propertyId: '1',
    propertyName: 'Westlands Apartments',
    unitNumber: '4B',
    leaseStartDate: '2024-01-01',
    leaseEndDate: '2024-12-31',
    rentAmount: 65000,
    status: 'ACTIVE',
    balance: 0,
    payments: [
      { id: '1', amount: 65000, date: '2024-02-01', status: 'COMPLETED' },
      { id: '2', amount: 65000, date: '2024-01-01', status: 'COMPLETED' },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{displayTenant.name}</h1>
          <p className="text-gray-500">
            {displayTenant.propertyName} • Unit {displayTenant.unitNumber}
          </p>
        </div>
        <Link
          to="/tenants/communications"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <MessageSquare className="h-4 w-4" />
          Message
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
          <div className="space-y-4">
            {displayTenant.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{displayTenant.email}</p>
                </div>
              </div>
            )}
            {displayTenant.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{displayTenant.phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lease Details</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Property</p>
                <Link
                  to={`/properties/${displayTenant.propertyId}`}
                  className="font-medium text-gray-900 hover:text-blue-600"
                >
                  {displayTenant.propertyName}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Unit</p>
                <p className="font-medium text-gray-900">{displayTenant.unitNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Lease Period</p>
                <p className="font-medium text-gray-900">
                  {formatDate(displayTenant.leaseStartDate)} - {formatDate(displayTenant.leaseEndDate)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Monthly Rent</p>
                <p className="font-medium text-gray-900">
                  {formatCurrency(displayTenant.rentAmount)}
                </p>
              </div>
            </div>
            {displayTenant.balance !== undefined && displayTenant.balance > 0 && (
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Outstanding balance: {formatCurrency(displayTenant.balance)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Payments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayTenant.payments?.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        payment.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!displayTenant.payments || displayTenant.payments.length === 0) && (
          <p className="text-center py-8 text-gray-500">No payment history</p>
        )}
      </div>
    </div>
  );
}
