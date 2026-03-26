'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tenantsService, invoicesService, propertiesService, unitsService } from '@bossnyumba/api-client';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowUpRight,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function PlatformOverviewPage() {
  const {
    data: tenant,
    isLoading: loadingTenants,
    error: tenantsError,
  } = useQuery({
    queryKey: ['admin-platform-overview-tenant'],
    queryFn: async () => {
      const res = await tenantsService.getCurrent();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load tenant');
    },
    staleTime: 30_000,
  });

  const {
    data: invoices,
    isLoading: loadingInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ['admin-platform-overview-invoices'],
    queryFn: async () => {
      const res = await invoicesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load invoices');
    },
    staleTime: 30_000,
  });

  const {
    data: properties,
    isLoading: loadingProperties,
    error: propertiesError,
  } = useQuery({
    queryKey: ['admin-platform-overview-properties'],
    queryFn: async () => {
      const res = await propertiesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load properties');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingTenants || loadingInvoices || loadingProperties;
  const error = tenantsError || invoicesError || propertiesError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Platform Overview Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load platform data.'}
        </p>
      </div>
    );
  }

  const tenantName = tenant?.name || 'Current Tenant';
  const tenantStatus = tenant?.status || '-';
  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const propertyList = Array.isArray(properties) ? properties : [];

  const totalRevenue = invoiceList.reduce((sum: number, inv: any) => sum + (inv.total || inv.amount || 0), 0);
  const totalUnits = propertyList.reduce((sum: number, p: any) => sum + (p.totalUnits || 0), 0);

  const formatCurrency = (value: number) => `TZS ${value.toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-gray-500">KPIs, active tenants, and revenue metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Building2 className="h-5 w-5 text-violet-600" />
            </div>
            <span className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                {tenantStatus}
              </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{tenantName}</p>
            <p className="text-sm text-gray-500">Active Tenant</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">{propertyList.length} properties</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Platform Users</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">Across all tenants</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">From invoices</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{totalUnits.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Units Managed</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">{propertyList.length} properties</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/platform/subscriptions"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <CheckCircle className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Subscriptions
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/platform/billing"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <CreditCard className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">Billing</span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/platform/feature-flags"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Activity className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Feature Flags
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/tenants"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Building2 className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              View Tenants
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
}
