import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../../../lib/api';

interface VendorContract {
  id: string;
  vendorId: string;
  vendorName: string;
  propertyId: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  value: number;
  status: string;
  type: string;
}

export default function VendorContractsPage() {
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<VendorContract[]>('/vendors/contracts').then((res) => {
      if (res.success && res.data) {
        setContracts(res.data);
      }
      setLoading(false);
    });
  }, []);

  const displayContracts = contracts.length
    ? contracts
    : [
        { id: '1', vendorId: '1', vendorName: 'QuickFix Plumbing', propertyId: '1', propertyName: 'Westlands Apartments', startDate: '2024-01-01', endDate: '2024-12-31', value: 2400000, status: 'ACTIVE', type: 'Annual Maintenance' },
        { id: '2', vendorId: '2', vendorName: 'SafeElectric Ltd', propertyId: '1', propertyName: 'Westlands Apartments', startDate: '2024-02-01', endDate: '2025-01-31', value: 1800000, status: 'ACTIVE', type: 'Electrical Services' },
        { id: '3', vendorId: '3', vendorName: 'CleanPro Services', propertyId: '1', propertyName: 'Westlands Apartments', startDate: '2023-06-01', endDate: '2024-05-31', value: 960000, status: 'EXPIRING_SOON', type: 'Cleaning' },
      ];

  const expiringSoon = displayContracts.filter((c) => c.status === 'EXPIRING_SOON' || c.status === 'EXPIRING');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/vendors"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Contracts</h1>
          <p className="text-gray-500">Manage your vendor service agreements</p>
        </div>
      </div>

      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">{expiringSoon.length} contract(s) expiring soon</p>
            <p className="text-sm text-yellow-700">Review and renew before expiry</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/vendors/${contract.vendorId}`}
                      className="flex items-center gap-2 font-medium text-gray-900 hover:text-blue-600"
                    >
                      <FileText className="h-4 w-4" />
                      {contract.vendorName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${contract.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {contract.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contract.type}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(contract.value)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        contract.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-700'
                          : contract.status === 'EXPIRING_SOON' || contract.status === 'EXPIRING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {contract.status === 'ACTIVE' ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {contract.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      View
                    </button>
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
