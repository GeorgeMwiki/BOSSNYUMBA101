'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { customersService } from '@bossnyumba/api-client';

export default function CustomersListPage() {
  const t = useTranslations('customersListPage');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', { page, pageSize: 20, search: search || undefined }],
    queryFn: () =>
      customersService.list({
        page,
        pageSize: 20,
        search: search || undefined,
      }),
    retry: false,
  });

  const customers = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('totalCount', { count: pagination?.totalItems ?? customers.length })}
        action={
          <Link href="/customers/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            {t('add')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <Alert variant="danger">
            <AlertDescription>
              {error instanceof Error ? error.message : t('failedToLoad')}
              <Button size="sm" onClick={() => refetch()} className="ml-2">{t('retry')}</Button>
            </AlertDescription>
          </Alert>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={t('emptyTitle')}
            description={search ? t('emptyFilteredDesc') : t('emptyDesc')}
            action={
              <Link href="/customers/new" className="btn-primary inline-block">
                {t('addCustomer')}
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {customers.map(
              (customer: {
                id: string;
                firstName: string;
                lastName: string;
                email: string;
                phone?: string;
                verificationStatus?: string;
                currentLease?: { unitNumber?: string };
              }) => (
                <Link key={customer.id} href={`/customers/${customer.id}`}>
                  <div className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {(customer.firstName?.[0] ?? '') + (customer.lastName?.[0] ?? '')}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">
                            {customer.firstName} {customer.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {customer.email}
                            {customer.currentLease?.unitNumber && (
                              <> • {t('unitPrefix', { unit: customer.currentLease.unitNumber })}</>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              className="btn-secondary"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('previous')}
            </button>
            <span className="py-2 text-sm text-gray-500">
              {t('pageOf', { page: pagination.page, total: pagination.totalPages })}
            </span>
            <button
              className="btn-secondary"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
