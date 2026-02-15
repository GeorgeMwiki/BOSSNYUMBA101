import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  DollarSign,
  MapPin,
  ArrowRight,
  BarChart3,
  Target,
} from 'lucide-react';
import { api, formatCurrency, formatPercentage } from '../../lib/api';

interface PortfolioSummary {
  totalProperties: number;
  totalUnits: number;
  totalValue: number;
  monthlyRevenue: number;
  occupancyRate: number;
  yoyGrowth: number;
}

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [properties, setProperties] = useState<Array<{
    id: string;
    name: string;
    type: string;
    totalUnits: number;
    occupiedUnits: number;
    monthlyRevenue: number;
    address: { city: string; country: string };
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<PortfolioSummary>('/portfolio/summary'),
      api.get<typeof properties>('/properties'),
    ]).then(([summaryRes, propertiesRes]) => {
      if (summaryRes.success && summaryRes.data) {
        setPortfolio(summaryRes.data);
      }
      if (propertiesRes.success && propertiesRes.data) {
        setProperties(propertiesRes.data);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const summary = portfolio || {
    totalProperties: properties.length,
    totalUnits: properties.reduce((acc, p) => acc + (p.totalUnits || 0), 0),
    totalValue: 0,
    monthlyRevenue: properties.reduce((acc, p) => acc + (p.monthlyRevenue || 0), 0),
    occupancyRate: properties.length
      ? properties.reduce((acc, p) => acc + ((p.occupiedUnits || 0) / (p.totalUnits || 1)) * 100, 0) / properties.length
      : 0,
    yoyGrowth: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-gray-500">View and manage your property investments</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/portfolio/performance"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <BarChart3 className="h-4 w-4" />
            Performance
          </Link>
          <Link
            to="/portfolio/growth"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <Target className="h-4 w-4" />
            Growth
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Properties</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{summary.totalProperties}</p>
          <p className="text-sm text-gray-500">{summary.totalUnits} total units</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Monthly Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(summary.monthlyRevenue)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupancy</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatPercentage(summary.occupancyRate)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Target className="h-5 w-5 text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">YoY Growth</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatPercentage(summary.yoyGrowth)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Properties</h3>
          <p className="text-sm text-gray-500">Your portfolio properties</p>
        </div>
        <div className="divide-y divide-gray-200">
          {properties.map((property) => (
            <Link
              key={property.id}
              to={`/properties/${property.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{property.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <MapPin className="h-4 w-4" />
                    {property.address?.city}, {property.address?.country}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(property.monthlyRevenue || 0)}
                  </p>
                  <p className="text-xs text-gray-500">monthly</p>
                </div>
                <span className="text-sm font-medium text-blue-600">
                  {formatPercentage(((property.occupiedUnits || 0) / (property.totalUnits || 1)) * 100)}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
        {properties.length === 0 && (
          <div className="p-12 text-center text-gray-500">No properties in portfolio</div>
        )}
      </div>
    </div>
  );
}
