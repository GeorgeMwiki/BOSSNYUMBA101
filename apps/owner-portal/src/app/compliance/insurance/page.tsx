import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Building2, Calendar } from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { formatCurrency, formatDate } from '../../../lib/api';
import { useInsurancePolicies } from '../../../lib/hooks';

export default function InsurancePage() {
  const { data: policies = [], isLoading, error, refetch } = useInsurancePolicies();

  // No fixture fallback — show real data or an empty state.
  const displayPolicies = policies;

  const totalCoverage = displayPolicies.reduce((a, p) => a + p.coverage, 0);
  const totalPremium = displayPolicies.reduce((a, p) => a + p.premium, 0);

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load insurance policies'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">Retry</Button>
        </AlertDescription>
      </Alert>
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

      {displayPolicies.length === 0 ? (
        <EmptyState
          title="No insurance policies yet"
          description="Add a property or liability insurance policy to track coverage and premiums."
        />
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
      )}
    </div>
  );
}
