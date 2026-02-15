import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileCheck, Building2, Calendar } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';

interface License {
  id: string;
  propertyId: string;
  propertyName: string;
  type: string;
  number: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: string;
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<License[]>('/compliance/licenses').then((res) => {
      if (res.success && res.data) {
        setLicenses(res.data);
      }
      setLoading(false);
    });
  }, []);

  const displayLicenses = licenses.length
    ? licenses
    : [
        { id: '1', propertyId: '1', propertyName: 'Westlands Apartments', type: 'Rental License', number: 'RL-2024-001', issuingAuthority: 'City Council', issueDate: '2024-01-01', expiryDate: '2025-01-01', status: 'ACTIVE' },
        { id: '2', propertyId: '1', propertyName: 'Westlands Apartments', type: 'Fire Safety Certificate', number: 'FSC-2024-001', issuingAuthority: 'Fire Department', issueDate: '2024-02-01', expiryDate: '2024-03-15', status: 'EXPIRING_SOON' },
        { id: '3', propertyId: '2', propertyName: 'Kilimani Complex', type: 'Rental License', number: 'RL-2024-002', issuingAuthority: 'City Council', issueDate: '2024-01-15', expiryDate: '2025-01-15', status: 'ACTIVE' },
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
      <div className="flex items-center gap-4">
        <Link to="/compliance" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Licenses</h1>
          <p className="text-gray-500">Track licenses and permits for your properties</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Authority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayLicenses.map((license) => (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <FileCheck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{license.type}</p>
                        <p className="text-sm text-gray-500">{license.number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${license.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {license.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{license.issuingAuthority}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(license.issueDate)} - {formatDate(license.expiryDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        license.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        license.status === 'EXPIRING_SOON' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {license.status.replace('_', ' ')}
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
