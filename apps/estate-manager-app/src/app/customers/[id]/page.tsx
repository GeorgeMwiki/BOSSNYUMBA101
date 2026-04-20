'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Phone, Calendar, Edit, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { customersService } from '@bossnyumba/api-client';

// Tenant region is env-driven per-deployment. No Kenya hardcode.
const TENANT_CURRENCY =
  process.env.NEXT_PUBLIC_TENANT_CURRENCY?.trim() || 'USD';
const TENANT_LOCALE = process.env.NEXT_PUBLIC_TENANT_LOCALE?.trim() || 'en';

export default function CustomerDetailPage() {
  const t = useTranslations('customerDetail');
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.get(id),
    retry: false,
  });

  const customer = data?.data;

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div aria-busy="true" aria-live="polite" className="px-4 py-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-4">
          <Alert variant="danger">
            <AlertDescription>
              {error instanceof Error ? error.message : t('failedLoad')}
              <Button size="sm" onClick={() => refetch()} className="ml-2">{t('retry')}</Button>
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  if (!customer) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-4">
          <EmptyState
            icon={<User className="h-8 w-8" />}
            title={t('notFound')}
            description={t('removedDesc')}
            action={
              <button onClick={() => router.back()} className="btn-secondary">
                {t('goBack')}
              </button>
            }
          />
        </div>
      </>
    );
  }

  const fullName = `${customer.firstName} ${customer.lastName}`;

  return (
    <>
      <PageHeader
        title={fullName}
        subtitle={customer.email}
        showBack
        action={
          <Link href={`/customers/${id}/edit`} className="btn-secondary text-sm flex items-center gap-1">
            <Edit className="w-4 h-4" />
            {t('edit')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        <div className="card p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('contactInfo')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <a href={`mailto:${customer.email}`} className="text-primary-600">
                {customer.email}
              </a>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400" />
                <a href={`tel:${customer.phone}`} className="text-primary-600">
                  {customer.phone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span
                className={
                  customer.verificationStatus === 'VERIFIED'
                    ? 'badge-success'
                    : customer.verificationStatus === 'REJECTED'
                  ? 'badge-danger'
                  : 'badge-warning'
                }
              >
                {customer.verificationStatus ?? 'PENDING'}
              </span>
            </div>
          </div>
        </div>

        {customer.currentUnit && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3">{t('currentUnit')}</h2>
            <Link href={`/units/${customer.currentUnit.id}`}>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <span className="font-medium">{t('unitPrefix', { unit: customer.currentUnit.unitNumber })}</span>
                <span className="text-primary-600">{t('view')}</span>
              </div>
            </Link>
          </div>
        )}

        {customer.leases && customer.leases.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('leaseHistory')}
            </h2>
            <div className="space-y-2">
              {customer.leases.map(
                (lease: {
                  id: string;
                  status: string;
                  startDate: string;
                  endDate: string;
                  rentAmount: number;
                }) => (
                  <div
                    key={lease.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="text-sm">
                        {new Date(lease.startDate).toLocaleDateString()} -{' '}
                        {new Date(lease.endDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Intl.NumberFormat(TENANT_LOCALE, {
                          style: 'currency',
                          currency: TENANT_CURRENCY,
                          minimumFractionDigits: 0,
                        }).format(lease.rentAmount)}
                        {t('perMonth')}
                      </div>
                    </div>
                    <span
                      className={
                        lease.status === 'ACTIVE'
                          ? 'badge-success'
                          : lease.status === 'TERMINATED'
                          ? 'badge-gray'
                          : 'badge-warning'
                      }
                    >
                      {lease.status}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Link
            href={`/leases/new?customerId=${id}`}
            className="card p-4 flex-1 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <Calendar className="w-6 h-6 text-primary-600" />
            <span className="font-medium">{t('newLease')}</span>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
