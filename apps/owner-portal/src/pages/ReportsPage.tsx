import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  FileText,
  DollarSign,
  Home,
  Wrench,
  Calendar,
} from 'lucide-react';
import { api, formatCurrency, formatPercentage } from '../lib/api';

interface FinancialReport {
  summary: {
    totalInvoiced: number;
    totalCollected: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  monthlyTrend: { month: string; invoiced: number; collected: number }[];
  arrearsAging: {
    current: number;
    overdue: number;
  };
}

interface OccupancyReport {
  summary: {
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    maintenanceUnits: number;
    occupancyRate: number;
  };
  byProperty: {
    id: string;
    name: string;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
  }[];
  leaseExpiry: {
    next30Days: number;
    next60Days: number;
  };
}

interface MaintenanceReport {
  summary: {
    total: number;
    completed: number;
    open: number;
    completionRate: number;
    avgResolutionTimeHours: number;
    totalCost: number;
  };
  byCategory: { category: string; count: number }[];
  byPriority: {
    emergency: number;
    high: number;
    medium: number;
    low: number;
  };
}

export function ReportsPage() {
  const [activeReport, setActiveReport] = useState<'financial' | 'occupancy' | 'maintenance'>('financial');
  const [financial, setFinancial] = useState<FinancialReport | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<FinancialReport>('/reports/financial'),
      api.get<OccupancyReport>('/reports/occupancy'),
      api.get<MaintenanceReport>('/reports/maintenance'),
    ]).then(([finRes, occRes, maintRes]) => {
      if (finRes.success && finRes.data) setFinancial(finRes.data);
      if (occRes.success && occRes.data) setOccupancy(occRes.data);
      if (maintRes.success && maintRes.data) setMaintenance(maintRes.data);
      setLoading(false);
    });
  }, []);

  const handleExport = async (type: string) => {
    const response = await api.get(`/reports/export/${type}`);
    if (response.success) {
      alert(`Export initiated. Download link will be available shortly.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const reports = [
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'occupancy', label: 'Occupancy', icon: Home },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Detailed analytics and insights</p>
        </div>
        <button
          onClick={() => handleExport(activeReport)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Report tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {reports.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id as typeof activeReport)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              activeReport === report.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <report.icon className="h-4 w-4" />
            {report.label}
          </button>
        ))}
      </div>

      {/* Financial Report */}
      {activeReport === 'financial' && financial && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Invoiced</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {formatCurrency(financial.summary.totalInvoiced)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Collected</p>
              <p className="mt-1 text-xl font-semibold text-green-600">
                {formatCurrency(financial.summary.totalCollected)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Outstanding</p>
              <p className="mt-1 text-xl font-semibold text-yellow-600">
                {formatCurrency(financial.summary.totalOutstanding)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Collection Rate</p>
              <p className="mt-1 text-xl font-semibold text-blue-600">
                {formatPercentage(financial.summary.collectionRate)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Arrears Aging</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700">Current</p>
                <p className="text-lg font-semibold text-green-800">
                  {formatCurrency(financial.arrearsAging.current)}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700">Overdue</p>
                <p className="text-lg font-semibold text-red-800">
                  {formatCurrency(financial.arrearsAging.overdue)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Occupancy Report */}
      {activeReport === 'occupancy' && occupancy && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {occupancy.summary.totalUnits}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Occupied</p>
              <p className="mt-1 text-xl font-semibold text-green-600">
                {occupancy.summary.occupiedUnits}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Available</p>
              <p className="mt-1 text-xl font-semibold text-yellow-600">
                {occupancy.summary.availableUnits}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Maintenance</p>
              <p className="mt-1 text-xl font-semibold text-orange-600">
                {occupancy.summary.maintenanceUnits}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Occupancy Rate</p>
              <p className="mt-1 text-xl font-semibold text-blue-600">
                {formatPercentage(occupancy.summary.occupancyRate)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">By Property</h3>
            <div className="space-y-3">
              {occupancy.byProperty.map((prop) => (
                <div
                  key={prop.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{prop.name}</p>
                    <p className="text-sm text-gray-500">
                      {prop.occupiedUnits}/{prop.totalUnits} units occupied
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {formatPercentage(prop.occupancyRate)}
                    </p>
                    <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${prop.occupancyRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Expiring Leases</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm text-yellow-700">Next 30 Days</p>
                </div>
                <p className="text-2xl font-semibold text-yellow-800 mt-2">
                  {occupancy.leaseExpiry.next30Days}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <p className="text-sm text-orange-700">Next 60 Days</p>
                </div>
                <p className="text-2xl font-semibold text-orange-800 mt-2">
                  {occupancy.leaseExpiry.next60Days}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Report */}
      {activeReport === 'maintenance' && maintenance && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Work Orders</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {maintenance.summary.total}
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-green-600">
                  {maintenance.summary.completed} completed
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-yellow-600">
                  {maintenance.summary.open} open
                </span>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Avg Resolution Time</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {maintenance.summary.avgResolutionTimeHours} hrs
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">
                {formatCurrency(maintenance.summary.totalCost)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">By Category</h3>
              <div className="space-y-3">
                {maintenance.byCategory.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <span className="text-gray-600">{cat.category}</span>
                    <span className="font-medium text-gray-900">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">By Priority</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Emergency
                  </span>
                  <span className="font-medium">{maintenance.byPriority.emergency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                    High
                  </span>
                  <span className="font-medium">{maintenance.byPriority.high}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    Medium
                  </span>
                  <span className="font-medium">{maintenance.byPriority.medium}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                    Low
                  </span>
                  <span className="font-medium">{maintenance.byPriority.low}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
