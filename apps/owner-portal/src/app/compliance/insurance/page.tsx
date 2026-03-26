import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  const totalCoverage = policies.reduce((a, p) => a + p.coverage, 0);
  const totalPremium = policies.reduce((a, p) => a + p.premium, 0);

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

      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <Shield className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No insurance policies</h3>
          <p className="text-gray-500 mb-4">Insurance policies for your properties will appear here.</p>
          <Link to="/compliance" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            <ArrowLeft className="h-4 w-4" />
            Back to Compliance
          </Link>
        </div>
      ) : (
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
              {policies.map((policy) => (
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
                    <button onClick={() => navigate(`/compliance/insurance/${policy.id}`)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
