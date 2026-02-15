import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency } from '../../lib/api';

export interface ArrearsAgingData {
  bucket: string;
  amount: number;
  count: number;
}

interface ArrearsAgingChartProps {
  data: ArrearsAgingData[];
  className?: string;
}

const BUCKET_COLORS: Record<string, string> = {
  '0-7 days': '#10B981',
  '8-14 days': '#F59E0B',
  '15-30 days': '#F97316',
  '31-60 days': '#EF4444',
  '60+ days': '#991B1B',
};

export function ArrearsAgingChart({ data, className }: ArrearsAgingChartProps) {
  const totalArrears = data.reduce((sum, item) => sum + item.amount, 0);
  const totalAccounts = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Arrears Aging</h3>
          <p className="text-sm text-gray-500">Outstanding balances by age bucket</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalArrears)}</p>
          <p className="text-sm text-gray-500">{totalAccounts} accounts</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis
              type="number"
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
            />
            <YAxis
              type="category"
              dataKey="bucket"
              stroke="#9CA3AF"
              fontSize={12}
              width={80}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Amount']}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
              }}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={BUCKET_COLORS[entry.bucket] || '#6B7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {data.map((item) => (
          <div key={item.bucket} className="text-center">
            <div
              className="w-full h-2 rounded mb-1"
              style={{ backgroundColor: BUCKET_COLORS[item.bucket] || '#6B7280' }}
            />
            <p className="text-xs text-gray-600">{item.bucket}</p>
            <p className="text-xs font-medium text-gray-900">{item.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
