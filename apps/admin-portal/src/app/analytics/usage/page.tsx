import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Filter,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const featureUsageData = [
  { feature: 'Property Management', daily: 1240, weekly: 8920, adoption: 94 },
  { feature: 'Payment Processing', daily: 980, weekly: 6840, adoption: 89 },
  { feature: 'Reports & Analytics', daily: 456, weekly: 3190, adoption: 72 },
  { feature: 'Tenant Portal', daily: 342, weekly: 2390, adoption: 68 },
  { feature: 'Lease Management', daily: 289, weekly: 2020, adoption: 61 },
  { feature: 'Maintenance Requests', daily: 234, weekly: 1640, adoption: 55 },
  { feature: 'Document Storage', daily: 189, weekly: 1320, adoption: 48 },
  { feature: 'Bulk Operations', daily: 95, weekly: 665, adoption: 32 },
];

const usageTrendData = [
  { week: 'Week 1', properties: 320, payments: 890, reports: 156 },
  { week: 'Week 2', properties: 345, payments: 920, reports: 178 },
  { week: 'Week 3', properties: 368, payments: 945, reports: 189 },
  { week: 'Week 4', properties: 385, payments: 980, reports: 205 },
];

export default function AnalyticsUsagePage() {
  const [period, setPeriod] = useState('weekly');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Feature Usage Metrics
          </h1>
          <p className="text-gray-500">
            Track feature adoption and usage across tenants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Usage Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feature
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Daily Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Weekly Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Adoption %
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {featureUsageData.map((row) => (
              <tr key={row.feature} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {row.feature}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {row.daily.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {row.weekly.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-600 rounded-full"
                        style={{ width: `${row.adoption}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {row.adoption}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Usage Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Usage Trend (4 weeks)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={usageTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip labelStyle={{ color: '#374151' }} />
              <Line
                type="monotone"
                dataKey="properties"
                name="Properties"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6' }}
              />
              <Line
                type="monotone"
                dataKey="payments"
                name="Payments"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
              />
              <Line
                type="monotone"
                dataKey="reports"
                name="Reports"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
