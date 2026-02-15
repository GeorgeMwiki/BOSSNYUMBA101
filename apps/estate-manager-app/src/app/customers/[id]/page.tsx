'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Mail, Phone, Calendar, Edit, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { customersService } from '@bossnyumba/api-client';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersService.get(id),
    retry: false,
  });

  const customer = data?.data;

  if (isLoading) {
    return (
      <>
        <PageHeader title="Customer" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  if (!customer) {
    return (
      <>
        <PageHeader title="Customer" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-500 mb-4">Customer not found</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
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
            Edit
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        <div className="card p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            Contact Info
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
            <h2 className="font-semibold mb-3">Current Unit</h2>
            <Link href={`/units/${customer.currentUnit.id}`}>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <span className="font-medium">Unit {customer.currentUnit.unitNumber}</span>
                <span className="text-primary-600">View →</span>
              </div>
            </Link>
          </div>
        )}

        {customer.leases && customer.leases.length > 0 && (
          <div className="card p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Lease History
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
                        {new Intl.NumberFormat('en-KE', {
                          style: 'currency',
                          currency: 'KES',
                          minimumFractionDigits: 0,
                        }).format(lease.rentAmount)}
                        /month
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
            <span className="font-medium">New Lease</span>
            <span className="ml-auto text-primary-600">→</span>
          </Link>
        </div>
      </div>
    </>
  );
}
