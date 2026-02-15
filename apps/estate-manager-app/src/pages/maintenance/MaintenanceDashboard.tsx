'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  Wrench,
  Star,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { workOrdersService, vendorsService, slaService } from '@bossnyumba/api-client';

// Fallback data
const fallbackSlaStatus = { breaches: 2, atRisk: 5, onTrack: 18 };
const fallbackCategories = [
  { category: 'Plumbing', count: 8 },
  { category: 'Electrical', count: 5 },
  { category: 'HVAC', count: 4 },
  { category: 'Structural', count: 3 },
  { category: 'Security', count: 2 },
];
const fallbackVendors = [
  { id: '1', name: 'QuickFix Plumbing', rating: 4.8, jobs: 24 },
  { id: '2', name: 'Pro Electric Co', rating: 4.6, jobs: 18 },
  { id: '3', name: 'General Maintenance', rating: 4.4, jobs: 12 },
];
const fallbackCompletions = [
  { id: '1', workOrderNumber: 'WO-2024-0042', title: 'Kitchen sink leak', completedAt: '2024-02-25T10:30:00Z', rating: 5, vendor: 'QuickFix Plumbing' },
  { id: '2', workOrderNumber: 'WO-2024-0039', title: 'Light fixture flickering', completedAt: '2024-02-24T16:00:00Z', rating: 4, vendor: 'Pro Electric' },
  { id: '3', workOrderNumber: 'WO-2024-0035', title: 'AC not cooling', completedAt: '2024-02-24T11:00:00Z', rating: 5, vendor: 'HVAC Pros' },
];

export default function MaintenanceDashboard() {
  // Fetch SLA health
  const { data: healthData, isLoading: loadingHealth } = useQuery({
    queryKey: ['sla', 'health'],
    queryFn: () => slaService.getHealthCheck(),
    retry: false,
  });

  // Fetch all work orders for category breakdown
  const { data: woData, isLoading: loadingWO } = useQuery({
    queryKey: ['workOrders', 'list', 'maintenance'],
    queryFn: () => workOrdersService.list(undefined, 1, 200),
    retry: false,
  });

  // Fetch vendors for top vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', 'all'],
    queryFn: () => vendorsService.list(),
    retry: false,
  });

  const isLoading = loadingHealth || loadingWO;

  // SLA Status from health check
  const slaStatus = useMemo(() => {
    const health = healthData?.data;
    if (!health) return fallbackSlaStatus;
    return {
      breaches: health.breached?.length ?? 0,
      atRisk: health.atRisk?.length ?? 0,
      onTrack: 0, // Will be calculated from WO data
    };
  }, [healthData]);

  // Work orders by category
  const { categoryCounts, openCount, completedRecent } = useMemo(() => {
    const workOrders = woData?.data;
    if (!workOrders || !Array.isArray(workOrders) || workOrders.length === 0) {
      return {
        categoryCounts: fallbackCategories,
        openCount: 18,
        completedRecent: fallbackCompletions,
      };
    }

    // Category breakdown
    const catMap: Record<string, number> = {};
    let open = 0;
    const completed: typeof fallbackCompletions = [];

    workOrders.forEach((wo: Record<string, unknown>) => {
      const cat = String(wo.category ?? 'General');
      catMap[cat] = (catMap[cat] ?? 0) + 1;
      const status = String(wo.status ?? '');
      if (!['COMPLETED', 'CANCELLED'].includes(status)) open++;

      if (status === 'COMPLETED' && completed.length < 5) {
        const vendor = wo.vendor as Record<string, unknown> | undefined;
        completed.push({
          id: String(wo.id),
          workOrderNumber: String(wo.workOrderNumber ?? wo.id ?? ''),
          title: String(wo.title ?? ''),
          completedAt: String(wo.completedAt ?? wo.updatedAt ?? ''),
          rating: Number(wo.customerRating ?? 0),
          vendor: vendor ? String(vendor.companyName ?? vendor.name ?? '') : '',
        });
      }
    });

    const categoryCounts = Object.entries(catMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      categoryCounts: categoryCounts.length > 0 ? categoryCounts : fallbackCategories,
      openCount: open,
      completedRecent: completed.length > 0 ? completed : fallbackCompletions,
    };
  }, [woData]);

  // Update on-track count
  const slaStatusFull = {
    ...slaStatus,
    onTrack: Math.max(0, openCount - slaStatus.breaches - slaStatus.atRisk),
  };

  // Top vendors
  const topVendors = useMemo(() => {
    const vendors = vendorsData?.data;
    if (!vendors || !Array.isArray(vendors) || vendors.length === 0) return fallbackVendors;
    return vendors
      .filter((v) => v.rating)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 3)
      .map((v) => ({
        id: v.id,
        name: v.companyName || v.name,
        rating: v.rating ?? 0,
        jobs: v.completedJobs ?? 0,
      }));
  }, [vendorsData]);

  const maxCategoryCount = Math.max(...categoryCounts.map((c) => c.count), 1);

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Overview"
        action={
          <Link href="/work-orders/new" className="btn-primary text-sm">
            New Work Order
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* SLA Status Widget */}
            <div className="card p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-600" />
                SLA Status
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <Link href="/work-orders?filter=breached" className="p-3 rounded-lg bg-danger-50 border border-danger-100">
                  <div className="flex items-center gap-2 text-danger-600 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-medium">Breaches</span>
                  </div>
                  <div className="text-2xl font-bold text-danger-600">{slaStatusFull.breaches}</div>
                </Link>
                <Link href="/work-orders?filter=urgent" className="p-3 rounded-lg bg-warning-50 border border-warning-100">
                  <div className="flex items-center gap-2 text-warning-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">At Risk</span>
                  </div>
                  <div className="text-2xl font-bold text-warning-600">{slaStatusFull.atRisk}</div>
                </Link>
                <div className="p-3 rounded-lg bg-success-50 border border-success-100">
                  <div className="flex items-center gap-2 text-success-600 mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">On Track</span>
                  </div>
                  <div className="text-2xl font-bold text-success-600">{slaStatusFull.onTrack}</div>
                </div>
              </div>

              <Link href="/sla" className="block mt-3 text-sm text-primary-600 text-center">
                View Full SLA Dashboard →
              </Link>
            </div>

            {/* Work Orders by Category */}
            <div className="card p-4">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary-600" />
                Work Orders by Category
              </h3>
              <div className="space-y-3">
                {categoryCounts.map((item) => (
                  <div key={item.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.category}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(item.count / maxCategoryCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Vendors */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                  Top Vendors
                </h3>
                <Link href="/vendors" className="text-sm text-primary-600">View All</Link>
              </div>
              <div className="space-y-3">
                {topVendors.map((vendor) => (
                  <Link key={vendor.id} href={`/vendors/${vendor.id}`}>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="font-medium text-sm">{vendor.name}</div>
                        <div className="text-xs text-gray-500">{vendor.jobs} jobs completed</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-warning-500 fill-warning-500" />
                        <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Completions */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success-600" />
                  Recent Completions
                </h3>
                <Link href="/work-orders" className="text-sm text-primary-600">View All</Link>
              </div>
              <div className="space-y-4">
                {completedRecent.map((item) => (
                  <Link key={item.id} href={`/work-orders/${item.id}`}>
                    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-xs text-gray-400">{item.workOrderNumber}</div>
                        <div className="font-medium text-sm">{item.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.vendor}{item.vendor && ' • '}{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
                        </div>
                      </div>
                      {item.rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-warning-500 fill-warning-500" />
                          <span className="font-medium">{item.rating}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
