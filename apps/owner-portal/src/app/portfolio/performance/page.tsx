import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Building2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, formatCurrency, formatPercentage } from '../../../lib/api';

interface PropertyPerformance {
  id: string;
  name: string;
  revenue: number;
  occupancy: number;
  noi: number;
  capRate: number;
}

export default function PortfolioPerformancePage() {
  const [data, setData] = useState<PropertyPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PropertyPerformance[]>('/portfolio/performance').then((res) => {
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    });
  }, []);

  const chartData = data;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/portfolio" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Property Performance</h1>
            <p className="text-gray-500">Compare performance across your properties</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900">No performance data yet</h2>
          <p className="text-sm text-gray-500 mt-1">Performance metrics will appear once your properties have activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/portfolio"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Property Performance</h1>
          <p className="text-gray-500">Compare performance across your properties</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Comparison</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                type="number"
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              />
              <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={12} width={80} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="noi" name="NOI" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {chartData.map(
          (property) => (
            <div
              key={property.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900">{property.name}</h4>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Monthly Revenue</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(property.revenue || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Occupancy</span>
                  <span className="font-medium text-gray-900">
                    {formatPercentage(property.occupancy || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">NOI</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(property.noi || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-500">Cap Rate</span>
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    {(property as { capRate?: number }).capRate ? (
                      <>
                        <TrendingUp className="h-4 w-4" />
                        {(property as { capRate?: number }).capRate}%
                      </>
                    ) : (
                      <>6.5%</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
