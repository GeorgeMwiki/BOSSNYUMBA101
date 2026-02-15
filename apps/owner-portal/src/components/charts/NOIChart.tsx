import React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../lib/api';

export interface NOIData {
  month: string;
  revenue: number;
  expenses: number;
  noi: number;
}

interface NOIChartProps {
  data: NOIData[];
  className?: string;
}

export function NOIChart({ data, className }: NOIChartProps) {
  const latestNOI = data[data.length - 1]?.noi || 0;
  const previousNOI = data[data.length - 2]?.noi || 0;
  const noiChange = previousNOI > 0 ? ((latestNOI - previousNOI) / previousNOI) * 100 : 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Net Operating Income</h3>
          <p className="text-sm text-gray-500">Revenue, expenses, and NOI trend</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(latestNOI)}</p>
          <p className={`text-sm ${noiChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {noiChange >= 0 ? '+' : ''}{noiChange.toFixed(1)}% vs last month
          </p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
            <YAxis
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
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
            <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
            <Line
              type="monotone"
              dataKey="noi"
              name="NOI"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: '#10B981', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
