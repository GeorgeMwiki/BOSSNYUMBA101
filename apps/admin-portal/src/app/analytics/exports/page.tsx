import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  Database,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'xlsx' | 'json';
  dataScope: string;
  lastExported: string | null;
}

interface RecentExport {
  id: string;
  name: string;
  format: string;
  size: string;
  status: 'completed' | 'in_progress' | 'failed';
  exportedAt: string | null;
  downloadUrl?: string;
}

const formatIcons: Record<string, React.ElementType> = {
  csv: FileText,
  xlsx: FileSpreadsheet,
  json: Database,
};

export default function AnalyticsExportsPage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('last30');
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templatesRes, recentRes] = await Promise.all([
        api.get<ExportTemplate[]>('/admin/analytics/exports/templates'),
        api.get<RecentExport[]>('/admin/analytics/exports/recent'),
      ]);

      if (templatesRes.success && templatesRes.data) {
        setExportTemplates(templatesRes.data);
      } else {
        setError(templatesRes.error || 'Failed to load export templates');
        return;
      }

      if (recentRes.success && recentRes.data) {
        setRecentExports(recentRes.data);
      } else {
        setError(recentRes.error || 'Failed to load recent exports');
        return;
      }
    } catch {
      setError('Network error while loading export data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (template: ExportTemplate) => {
    setExportingId(template.id);
    try {
      const res = await api.post<RecentExport>('/admin/analytics/exports', {
        templateId: template.id,
        format: template.format,
        dateRange,
      });
      if (res.success && res.data) {
        setRecentExports((prev) => [res.data!, ...prev]);
      }
    } catch {
      setExportError('Export request failed. Please try again.');
    } finally {
      setExportingId(null);
    }
  };

  const handleDownload = async (exp: RecentExport) => {
    setDownloadingId(exp.id);
    try {
      const res = await api.get<{ url: string }>(`/admin/analytics/exports/${exp.id}/download`);
      if (res.success && res.data?.url) {
        window.open(res.data.url, '_blank');
      }
    } catch {
      setExportError('Download failed. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-56 bg-gray-200 rounded" />
            <div className="h-4 w-72 bg-gray-200 rounded mt-2" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-36 bg-gray-200 rounded-lg" />
            <div className="h-10 w-24 bg-gray-200 rounded-lg" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="h-5 w-36 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-200">
                <div className="h-10 w-10 bg-gray-200 rounded-lg mb-3" />
                <div className="h-5 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-48 bg-gray-200 rounded mt-2" />
                <div className="h-9 w-full bg-gray-200 rounded mt-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to Load Exports</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {exportError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-red-800">{exportError}</span>
          </div>
          <button onClick={() => setExportError(null)} className="text-red-400 hover:text-red-600">
            <span className="sr-only">Dismiss</span>&times;
          </button>
        </div>
      )}
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
          <button onClick={() => setDateRange(dateRange === 'last30' ? 'last7' : 'last30')} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
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
            const FormatIcon = formatIcons[template.format] || FileText;
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
                <button
                  onClick={() => handleExport(template)}
                  disabled={exportingId === template.id}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportingId === template.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Export {template.format.toUpperCase()}
                    </>
                  )}
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
                    <button
                      onClick={() => handleDownload(exp)}
                      disabled={downloadingId === exp.id}
                      className="text-sm text-violet-600 hover:text-violet-700 disabled:opacity-50"
                    >
                      {downloadingId === exp.id ? 'Downloading...' : 'Download'}
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
          <button onClick={() => navigate('/analytics/exports/schedule')} className="mt-4 px-4 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
            Schedule Export
          </button>
        </div>
      </div>
    </div>
  );
}
