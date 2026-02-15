import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Building2, Calendar } from 'lucide-react';
import { api, formatCurrency, formatDate } from '../../../lib/api';

interface InsurancePolicy {
  id: string;
  propertyId: string;
  propertyName: string;
  provider: string;
  type: string;
  policyNumber: string;
  coverage: number;
  premium: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function InsurancePage() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<InsurancePolicy[]>('/compliance/insurance').then((res) => {
      if (res.success && res.data) {
        setPolicies(res.data);
      }
      setLoading(false);
    });
  }, []);

  const displayPolicies = policies.length
    ? policies
    : [
        { id: '1', propertyId: '1', propertyName: 'Westlands Apartments', provider: 'Jubilee Insurance', type: 'Property', policyNumber: 'POL-2024-001', coverage: 50000000, premium: 450000, startDate: '2024-01-01', endDate: '2024-12-31', status: 'ACTIVE' },
        { id: '2', propertyId: '1', propertyName: 'Westlands Apartments', provider: 'APA Insurance', type: 'Liability', policyNumber: 'POL-2024-002', coverage: 10000000, premium: 120000, startDate: '2024-01-01', endDate: '2024-12-31', status: 'ACTIVE' },
        { id: '3', propertyId: '2', propertyName: 'Kilimani Complex', provider: 'Jubilee Insurance', type: 'Property', policyNumber: 'POL-2024-003', coverage: 35000000, premium: 320000, startDate: '2024-02-01', endDate: '2025-01-31', status: 'ACTIVE' },
      ];

  const totalCoverage = displayPolicies.reduce((a, p) => a + p.coverage, 0);
  const totalPremium = displayPolicies.reduce((a, p) => a + p.premium, 0);

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
        <Link to="/compliance" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Tracking</h1>
          <p className="text-gray-500">Manage property insurance policies</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total Coverage</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalCoverage)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Annual Premium</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalPremium)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coverage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Premium</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayPolicies.map((policy) => (
                <tr key={policy.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{policy.type}</p>
                        <p className="text-sm text-gray-500">{policy.policyNumber}</p>
                        <p className="text-xs text-gray-500">{policy.provider}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${policy.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {policy.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatCurrency(policy.coverage)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatCurrency(policy.premium)}/yr
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(policy.startDate)} - {formatDate(policy.endDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        policy.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {policy.status}
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
