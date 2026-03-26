'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantsService } from '@bossnyumba/api-client';
import {
  Flag,
  RefreshCw,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Settings,
} from 'lucide-react';

export default function FeatureFlagsPage() {
  const {
    data: settings,
    isLoading: loadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: ['admin-feature-flags-settings'],
    queryFn: async () => {
      const res = await tenantsService.getSettings();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load tenant settings');
    },
    staleTime: 30_000,
  });

  const {
    data: tenant,
    isLoading: loadingTenant,
    error: tenantError,
  } = useQuery({
    queryKey: ['admin-feature-flags-tenant'],
    queryFn: async () => {
      const res = await tenantsService.getCurrent();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load tenant');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingSettings || loadingTenant;
  const error = settingsError || tenantError;

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
        <h2 className="text-lg font-semibold text-gray-900">Feature Flags Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load feature flag data.'}
        </p>
      </div>
    );
  }

  const features = settings?.features || [];
  const enabledCount = features.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-sm text-gray-500 mt-1">
          Feature configuration for {tenant?.name || 'current tenant'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Flag className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{enabledCount}</p>
            <p className="text-sm text-gray-500">Enabled Features</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <ToggleRight className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{settings?.timezone || '-'}</p>
            <p className="text-sm text-gray-500">Timezone</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Settings className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{settings?.currency || '-'}</p>
            <p className="text-sm text-gray-500">Currency</p>
          </div>
        </div>
      </div>

      {/* Feature Flags List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Feature Flags</h3>
        </div>
        {features.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No feature flags configured</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {features.map((feature: string, index: number) => (
              <div key={index} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ToggleRight className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-900">{feature}</span>
                </div>
                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                  Enabled
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tenant Configuration */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Tenant Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Locale</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{settings?.locale || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Currency</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{settings?.currency || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Timezone</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{settings?.timezone || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Tenant</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{tenant?.name || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
