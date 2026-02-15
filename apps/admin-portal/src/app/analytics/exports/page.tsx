import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  Database,
} from 'lucide-react';

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'xlsx' | 'json';
  dataScope: string;
  lastExported: string | null;
}

const exportTemplates: ExportTemplate[] = [
  {
    id: '1',
    name: 'Tenant Summary',
    description: 'All tenants with subscription and usage data',
    format: 'csv',
    dataScope: 'Platform',
    lastExported: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '2',
    name: 'Revenue Report',
    description: 'MRR, ARR, and payment history by tenant',
    format: 'xlsx',
    dataScope: 'Platform',
    lastExported: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '3',
    name: 'User Activity Log',
    description: 'Login and audit events per tenant',
    format: 'csv',
    dataScope: 'Platform',
    lastExported: null,
  },
  {
    id: '4',
    name: 'Property Portfolio',
    description: 'All properties and units across tenants',
    format: 'xlsx',
    dataScope: 'Platform',
    lastExported: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: '5',
    name: 'API Usage Analytics',
    description: 'API calls, endpoints, and errors by tenant',
    format: 'json',
    dataScope: 'Platform',
    lastExported: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: '6',
    name: 'Compliance Report',
    description: 'GDPR data requests and processing status',
    format: 'csv',
    dataScope: 'Platform',
    lastExported: null,
  },
];

const recentExports = [
  {
    id: '1',
    name: 'Tenant Summary',
    format: 'csv',
    size: '2.4 MB',
    status: 'completed',
    exportedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    name: 'API Usage Analytics',
    format: 'json',
    size: '5.1 MB',
    status: 'completed',
    exportedAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: '3',
    name: 'Revenue Report',
    format: 'xlsx',
    size: '1.2 MB',
    status: 'in_progress',
    exportedAt: null,
  },
];

const formatIcons: Record<string, React.ElementType> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  json: Database,
};

export default function AnalyticsExportsPage() {
  const [dateRange, setDateRange] = useState('last30');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Export Analytics Data
          </h1>
          <p className="text-gray-500">
            Generate and download platform analytics reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="custom">Custom range</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Export Templates */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Export Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exportTemplates.map((template) => {
            const FormatIcon = formatIcons[template.format];
            return (
              <div
                key={template.id}
                className="p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <FormatIcon className="h-5 w-5 text-violet-600" />
                  </div>
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded uppercase">
                    {template.format}
                  </span>
                </div>
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                {template.lastExported && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last exported: {new Date(template.lastExported).toLocaleDateString()}
                  </p>
                )}
                <button className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                  <Download className="h-4 w-4" />
                  Export {template.format.toUpperCase()}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Exports */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Exports</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Export
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Format
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Exported
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recentExports.map((exp) => (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {exp.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {exp.format.toUpperCase()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {exp.size}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                      exp.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {exp.status === 'completed' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {exp.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {exp.exportedAt
                    ? new Date(exp.exportedAt).toLocaleString()
                    : 'In progress...'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {exp.status === 'completed' && (
                    <button className="text-sm text-violet-600 hover:text-violet-700">
                      Download
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scheduled Exports */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Scheduled Exports</h3>
        <div className="text-center py-8 rounded-lg border-2 border-dashed border-gray-200">
          <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            No scheduled exports. Set up automated exports for recurring reports.
          </p>
          <button className="mt-4 px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
            Schedule Export
          </button>
        </div>
      </div>
    </div>
  );
}
