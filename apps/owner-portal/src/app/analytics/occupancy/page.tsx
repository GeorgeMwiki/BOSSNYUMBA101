import React, { useEffect, useState } from 'react';
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
import { api, formatPercentage } from '../../../lib/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

interface OccupancyMeta {
  rate: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
}

interface Property {
  id: string;
  name: string;
}

export default function OccupancyPage() {
  const [trendData, setTrendData] = useState<Array<{ month: string; rate: number }>>([]);
  const [meta, setMeta] = useState<OccupancyMeta | null>(null);
  const [byProperty, setByProperty] = useState<Array<{ name: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const trendRes = await api.get<
          Array<{ month: string; rate: number }>
        >('/analytics/occupancy');

        if (cancelled) return;

        if (trendRes.success && trendRes.data) {
          setTrendData(trendRes.data);
          const responseMeta = (trendRes as { meta?: OccupancyMeta }).meta;
          if (responseMeta) setMeta(responseMeta);
        } else {
          setTrendData([]);
          setError(trendRes.error?.message ?? 'Live occupancy KPIs are unavailable.');
        }

        // Fetch per-property breakdown using the properties list + per-property KPI calls.
        const propsRes = await api.get<Property[]>('/properties');
        if (propsRes.success && propsRes.data) {
          const perProperty = await Promise.all(
            propsRes.data.map(async (property) => {
              const res = await api.get<OccupancyMeta>(
                `/analytics/kpis/occupancy?propertyId=${encodeURIComponent(property.id)}`
              );
              return {
                name: property.name,
                value: res.success && res.data ? res.data.rate : 0,
              };
            })
          );
          if (!cancelled) setByProperty(perProperty.filter((p) => p.value > 0));
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Live occupancy KPIs are unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayData = trendData;

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
        <Link to="/analytics" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Occupancy Trends</h1>
          <p className="text-gray-500">Track occupancy rates across your portfolio</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Current Rate</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {meta ? formatPercentage(meta.rate) : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Vacant Units</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {meta ? meta.vacantUnits : '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Home className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupied Units</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {meta ? meta.occupiedUnits : '—'}
          </p>
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
