import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

      {licenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200">
          <FileCheck className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No licenses found</h3>
          <p className="text-gray-500 mb-4">Property licenses and permits will appear here.</p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Authority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {licenses.map((license) => (
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
                    <button onClick={() => navigate(`/compliance/licenses/${license.id}`)} className="text-sm font-medium text-blue-600 hover:text-blue-700">
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
