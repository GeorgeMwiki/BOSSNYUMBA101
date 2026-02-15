'use client';

import Link from 'next/link';
import {
  Building2,
  Home,
  Percent,
  ClipboardList,
  Loader2,
  CheckCircle,
  DollarSign,
  Calendar,
  UserPlus,
  CreditCard,
  Wrench,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  propertiesService,
  unitsService,
  leasesService,
  workOrdersService,
  paymentsService,
} from '@bossnyumba/api-client';

function formatCurrency(amount: number, currency = 'KES') {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ['properties', { page: 1, pageSize: 100 }],
    queryFn: () => propertiesService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  const { data: unitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['units', { page: 1, pageSize: 500 }],
    queryFn: () => unitsService.list({ page: 1, pageSize: 500 }),
    retry: false,
  });

  const { data: workOrdersData, isLoading: loadingWorkOrders } = useQuery({
    queryKey: ['workOrders', 'list'],
    queryFn: () => workOrdersService.list(undefined, 1, 100),
    retry: false,
  });

  const { data: leasesData, isLoading: loadingLeases } = useQuery({
    queryKey: ['leases', 'expiring'],
    queryFn: () => leasesService.getExpiring(60, 1, 5),
    retry: false,
  });

  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: () =>
      paymentsService.list(
        {
          dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        } as never,
        1,
        5
      ),
    retry: false,
  });

  const properties = propertiesData?.data ?? [];
  const units = unitsData?.data ?? [];
  const workOrders = Array.isArray(workOrdersData?.data) ? workOrdersData.data : [];
  const expiringLeases = Array.isArray(leasesData?.data) ? leasesData.data : [];
  const recentPayments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];

  const totalProperties = properties.length;
  const totalUnits = units.length;
  const occupiedUnits = units.filter((u: { status?: string }) => u.status === 'OCCUPIED').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const openWorkOrders = workOrders.filter(
    (wo: { status?: string }) => !['COMPLETED', 'CANCELLED'].includes(wo.status ?? '')
  ).length;
  const inProgressWorkOrders = workOrders.filter(
    (wo: { status?: string }) => wo.status === 'IN_PROGRESS'
  ).length;
  const today = new Date().toISOString().split('T')[0];
  const completedToday = workOrders.filter(
    (wo: { status?: string; completedAt?: string }) =>
      wo.status === 'COMPLETED' && wo.completedAt && String(wo.completedAt).startsWith(today)
  ).length;

  const isLoading =
    loadingProperties || loadingUnits || loadingWorkOrders || loadingLeases || loadingPayments;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Estate Manager Overview"
        showProfile
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Property Overview Cards */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Property Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link href="/properties" className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Building2 className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalProperties}</div>
                      <div className="text-xs text-gray-500">Properties</div>
                    </div>
                  </div>
                </Link>
                <Link href="/units" className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Home className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalUnits}</div>
                      <div className="text-xs text-gray-500">Total Units</div>
                    </div>
                  </div>
                </Link>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success-50 rounded-lg">
                      <Percent className="w-5 h-5 text-success-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{occupancyRate}%</div>
                      <div className="text-xs text-gray-500">Occupancy Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Work Order Summary */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Work Orders</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link href="/work-orders?filter=open" className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning-50 rounded-lg">
                      <ClipboardList className="w-5 h-5 text-warning-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{openWorkOrders}</div>
                      <div className="text-xs text-gray-500">Open</div>
                    </div>
                  </div>
                </Link>
                <Link href="/work-orders?status=IN_PROGRESS" className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Loader2 className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{inProgressWorkOrders}</div>
                      <div className="text-xs text-gray-500">In Progress</div>
                    </div>
                  </div>
                </Link>
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success-50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-success-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{completedToday}</div>
                      <div className="text-xs text-gray-500">Completed Today</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  href="/work-orders/new"
                  className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow border-primary-200 bg-primary-50/50"
                >
                  <Wrench className="w-6 h-6 text-primary-600" />
                  <span className="font-medium">Create Work Order</span>
                </Link>
                <Link
                  href="/customers/new"
                  className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
                >
                  <UserPlus className="w-6 h-6 text-primary-600" />
                  <span className="font-medium">Add Customer</span>
                </Link>
                <Link
                  href="/payments/receive"
                  className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
                >
                  <CreditCard className="w-6 h-6 text-primary-600" />
                  <span className="font-medium">Receive Payment</span>
                </Link>
              </div>
            </section>

            {/* Recent Payments */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Recent Payments
                </h2>
                <Link href="/payments" className="text-sm text-primary-600">
                  View All
                </Link>
              </div>
              <div className="card divide-y divide-gray-100">
                {recentPayments.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No recent payments
                  </div>
                ) : (
                  recentPayments.map(
                    (
                      payment: {
                        id: string;
                        amount?: number;
                        currency?: string;
                        createdAt?: string;
                        amountInCents?: number;
                      }
                    ) => {
                      const amount =
                        payment.amount ?? (payment.amountInCents ? payment.amountInCents / 100 : 0);
                      return (
                        <div
                          key={payment.id}
                          className="p-3 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {formatCurrency(amount, payment.currency)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {payment.createdAt ? formatDate(payment.createdAt) : ''}
                            </div>
                          </div>
                          <span className="badge-success">Completed</span>
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </section>

            {/* Upcoming Lease Expirations */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Upcoming Lease Expirations
                </h2>
                <Link href="/leases?expiring=true" className="text-sm text-primary-600">
                  View All
                </Link>
              </div>
              <div className="card divide-y divide-gray-100">
                {expiringLeases.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No leases expiring in the next 60 days
                  </div>
                ) : (
                  expiringLeases.map(
                    (lease: {
                      id: string;
                      endDate: string;
                      unit?: { unitNumber?: string };
                      customer?: { name?: string };
                      property?: { name?: string };
                    }) => (
                      <Link key={lease.id} href={`/leases/${lease.id}`}>
                        <div className="p-3 flex justify-between items-center hover:bg-gray-50">
                          <div>
                            <div className="font-medium text-sm">
                              {lease.unit?.unitNumber} - {lease.customer?.name || 'Tenant'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {lease.property?.name} • Expires {formatDate(lease.endDate)}
                            </div>
                          </div>
                          <span className="badge-warning">Expiring</span>
                        </div>
                      </Link>
                    )
                  )
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
