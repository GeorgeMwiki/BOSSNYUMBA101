import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Users } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { formatPercentage } from '../../../lib/api';
import { useOccupancyAnalytics } from '../../../lib/hooks';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

export default function OccupancyPage() {
  const { data: trendData = [], isLoading, error, refetch } = useOccupancyAnalytics();

  const displayData = trendData.length
    ? trendData
    : [
        { month: 'Aug', rate: 85 },
        { month: 'Sep', rate: 87 },
        { month: 'Oct', rate: 89 },
        { month: 'Nov', rate: 92 },
        { month: 'Dec', rate: 91 },
        { month: 'Jan', rate: 93 },
        { month: 'Feb', rate: 91 },
      ];

  const byProperty = [
    { name: 'Property A', value: 92 },
    { name: 'Property B', value: 88 },
    { name: 'Property C', value: 95 },
  ];

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load occupancy analytics'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/analytics" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Occupancy Trends</h1>
          <p className="text-gray-500">Track occupancy rates across your portfolio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Current Rate</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatPercentage(displayData[displayData.length - 1]?.rate || 91)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Vacant Units</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">12</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Home className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupied Units</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">128</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  domain={[80, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Occupancy']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Property</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byProperty}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                >
                  {byProperty.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
