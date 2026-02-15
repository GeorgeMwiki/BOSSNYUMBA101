import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../lib/api';

export interface MaintenanceCostData {
  month: string;
  plumbing: number;
  electrical: number;
  hvac: number;
  structural: number;
  other: number;
  total: number;
}

interface MaintenanceCostTrendsProps {
  data: MaintenanceCostData[];
  className?: string;
}

const CATEGORY_COLORS = {
  plumbing: '#3B82F6',
  electrical: '#F59E0B',
  hvac: '#10B981',
  structural: '#8B5CF6',
  other: '#6B7280',
};

export function MaintenanceCostTrends({ data, className }: MaintenanceCostTrendsProps) {
  const totalCost = data.reduce((sum, item) => sum + item.total, 0);
  const avgMonthlyCost = totalCost / data.length;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Maintenance Cost Trends</h3>
          <p className="text-sm text-gray-500">Cost breakdown by category over time</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgMonthlyCost)}</p>
          <p className="text-sm text-gray-500">avg. monthly</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="plumbing"
              name="Plumbing"
              stackId="1"
              stroke={CATEGORY_COLORS.plumbing}
              fill={CATEGORY_COLORS.plumbing}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="electrical"
              name="Electrical"
              stackId="1"
              stroke={CATEGORY_COLORS.electrical}
              fill={CATEGORY_COLORS.electrical}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="hvac"
              name="HVAC"
              stackId="1"
              stroke={CATEGORY_COLORS.hvac}
              fill={CATEGORY_COLORS.hvac}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="structural"
              name="Structural"
              stackId="1"
              stroke={CATEGORY_COLORS.structural}
              fill={CATEGORY_COLORS.structural}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="other"
              name="Other"
              stackId="1"
              stroke={CATEGORY_COLORS.other}
              fill={CATEGORY_COLORS.other}
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category Summary */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {Object.entries(CATEGORY_COLORS).map(([category, color]) => {
          const categoryTotal = data.reduce((sum, item) => sum + (item[category as keyof MaintenanceCostData] as number || 0), 0);
          return (
            <div key={category} className="text-center">
              <div className="w-full h-2 rounded mb-1" style={{ backgroundColor: color }} />
              <p className="text-xs text-gray-600 capitalize">{category}</p>
              <p className="text-xs font-medium text-gray-900">{formatCurrency(categoryTotal)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
