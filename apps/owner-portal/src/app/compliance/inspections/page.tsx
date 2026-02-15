import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Building2, Calendar, CheckCircle } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';

interface Inspection {
  id: string;
  propertyId: string;
  propertyName: string;
  type: string;
  scheduledDate: string;
  completedDate?: string;
  status: string;
  result?: string;
}

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Inspection[]>('/compliance/inspections').then((res) => {
      if (res.success && res.data) {
        setInspections(res.data);
      }
      setLoading(false);
    });
  }, []);

  const displayInspections = inspections.length
    ? inspections
    : [
        { id: '1', propertyId: '1', propertyName: 'Westlands Apartments', type: 'Fire Safety', scheduledDate: '2024-02-28', status: 'SCHEDULED' },
        { id: '2', propertyId: '1', propertyName: 'Westlands Apartments', type: 'Electrical', scheduledDate: '2024-01-15', completedDate: '2024-01-15', status: 'PASSED', result: 'PASSED' },
        { id: '3', propertyId: '2', propertyName: 'Kilimani Complex', type: 'Fire Safety', scheduledDate: '2024-03-15', status: 'SCHEDULED' },
        { id: '4', propertyId: '2', propertyName: 'Kilimani Complex', type: 'Health & Safety', scheduledDate: '2024-02-10', completedDate: '2024-02-10', status: 'PASSED', result: 'PASSED' },
      ];

  const upcoming = displayInspections.filter((i) => i.status === 'SCHEDULED');
  const completed = displayInspections.filter((i) => i.status === 'PASSED' || i.status === 'COMPLETED');

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
          <h1 className="text-2xl font-bold text-gray-900">Inspection Schedule</h1>
          <p className="text-gray-500">Track property inspections and compliance checks</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Upcoming</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{upcoming.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Completed</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{completed.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClipboardList className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{displayInspections.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Inspections</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayInspections.map((inspection) => (
                <tr key={inspection.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{inspection.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/properties/${inspection.propertyId}`}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      <Building2 className="h-4 w-4" />
                      {inspection.propertyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(inspection.scheduledDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {inspection.completedDate ? formatDate(inspection.completedDate) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        inspection.status === 'PASSED' || inspection.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : inspection.status === 'SCHEDULED'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {inspection.status}
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
