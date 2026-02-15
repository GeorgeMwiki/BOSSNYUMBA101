'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { customersService } from '@bossnyumba/api-client';

export default function CustomersListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
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
        title="Customers"
        subtitle={`${pagination?.totalItems ?? customers.length} total`}
        action={
          <Link href="/customers/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : customers.length === 0 ? (
          <div className="card p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No customers found</p>
            <Link href="/customers/new" className="btn-primary mt-4 inline-block">
              Add Customer
            </Link>
          </div>
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
                              <> • Unit {customer.currentLease.unitNumber}</>
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
              Previous
            </button>
            <span className="py-2 text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
