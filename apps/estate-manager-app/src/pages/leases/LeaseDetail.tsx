'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Calendar,
  User,
  CreditCard,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { DateDisplay } from '@/components/DateDisplay';
import { leasesService, paymentsService } from '@bossnyumba/api-client';

interface PaymentRecord {
  id: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue';
  reference?: string;
}

interface LeaseDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
}

// Fallback data
const fallbackLease = {
  id: '1',
  leaseNumber: 'LSE-2024-001',
  unit: 'A-204',
  property: 'Sunset Apartments',
  tenantName: 'John Kamau',
  tenantPhone: '+254 712 345 678',
  tenantEmail: 'john.kamau@email.com',
  status: 'active' as const,
  monthlyRent: 45000,
  startDate: '2024-01-01',
  endDate: '2025-12-31',
  deposit: 90000,
  depositPaid: true,
  paymentDay: 1,
  terms: '12-month fixed term. Standard lease terms apply.',
};

const fallbackPayments: PaymentRecord[] = [
  { id: '1', amount: 45000, dueDate: '2024-03-01', paidDate: '2024-02-28', status: 'paid', reference: 'MPESA-ABC123' },
  { id: '2', amount: 45000, dueDate: '2024-02-01', paidDate: '2024-01-30', status: 'paid', reference: 'MPESA-DEF456' },
  { id: '3', amount: 45000, dueDate: '2024-04-01', paidDate: undefined, status: 'pending' },
];

const fallbackDocs: LeaseDocument[] = [
  { id: '1', name: 'lease-agreement.pdf', type: 'Lease Agreement', uploadedAt: '2024-01-01' },
  { id: '2', name: 'signed-addendum.pdf', type: 'Addendum', uploadedAt: '2024-01-15' },
];

const statusMap: Record<string, string> = {
  ACTIVE: 'active',
  PENDING: 'pending',
  DRAFT: 'pending',
  EXPIRED: 'expired',
  TERMINATED: 'cancelled',
  CANCELLED: 'cancelled',
  RENEWED: 'active',
};

const paymentStatusMap: Record<string, 'paid' | 'pending' | 'overdue'> = {
  COMPLETED: 'paid',
  SUCCEEDED: 'paid',
  PAID: 'paid',
  PENDING: 'pending',
  PROCESSING: 'pending',
  REQUIRES_PAYMENT: 'pending',
  FAILED: 'overdue',
  OVERDUE: 'overdue',
};

interface LeaseDetailProps {
  leaseId: string;
}

export function LeaseDetail({ leaseId }: LeaseDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'documents'>('overview');

  // Fetch lease details
  const { data: leaseData, isLoading: loadingLease } = useQuery({
    queryKey: ['lease', leaseId],
    queryFn: () => leasesService.get(leaseId),
    retry: false,
  });

  // Fetch payment history for this lease
  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', 'lease', leaseId],
    queryFn: () => paymentsService.list({ leaseId }, 1, 50),
    retry: false,
    enabled: activeTab === 'payments',
  });

  const lease = useMemo(() => {
    const l = leaseData?.data as Record<string, unknown> | undefined;
    if (!l) return fallbackLease;

    const unit = l.unit as Record<string, unknown> | undefined;
    const property = l.property as Record<string, unknown> | undefined;
    const customer = l.customer as Record<string, unknown> | undefined;
    const terms = l.terms as Record<string, unknown> | undefined;

    const rawStatus = String(l.status ?? 'ACTIVE');

    return {
      id: String(l.id ?? leaseId),
      leaseNumber: String(l.leaseNumber ?? l.id ?? ''),
      unit: unit ? String(unit.unitNumber ?? '') : '',
      property: property ? String(property.name ?? '') : '',
      tenantName: customer ? String(customer.name ?? '') : '',
      tenantPhone: customer ? String(customer.phone ?? customer.phoneNumber ?? '') : '',
      tenantEmail: customer ? String(customer.email ?? '') : '',
      status: (statusMap[rawStatus] ?? rawStatus.toLowerCase()) as 'active' | 'pending' | 'expired',
      monthlyRent: Number(l.rentAmount ?? 0),
      startDate: String(l.startDate ?? ''),
      endDate: String(l.endDate ?? ''),
      deposit: Number(l.depositAmount ?? 0),
      depositPaid: Number(l.depositPaid ?? 0) >= Number(l.depositAmount ?? 0),
      paymentDay: Number(l.paymentDueDay ?? 1),
      terms: terms ? JSON.stringify(terms) : String(l.notes ?? '12-month fixed term. Standard lease terms apply.'),
    };
  }, [leaseData, leaseId]);

  const paymentHistory = useMemo(() => {
    const payments = paymentsData?.data;
    if (!payments || !Array.isArray(payments) || payments.length === 0) return fallbackPayments;

    return payments.map((p: Record<string, unknown>) => {
      const amount = p.amount as Record<string, unknown> | undefined;
      const rawStatus = String(p.status ?? 'PENDING');

      return {
        id: String(p.id),
        amount: Number(amount?.amount ?? p.amount ?? 0),
        dueDate: String(p.dueDate ?? p.createdAt ?? ''),
        paidDate: p.paidAt ? String(p.paidAt) : p.completedAt ? String(p.completedAt) : undefined,
        status: paymentStatusMap[rawStatus] ?? 'pending',
        reference: p.reference ? String(p.reference) : p.externalReference ? String(p.externalReference) : undefined,
      } as PaymentRecord;
    });
  }, [paymentsData]);

  // TODO: Documents would come from a documents API; for now use fallback
  const documents = fallbackDocs;

  if (loadingLease) {
    return (
      <>
        <PageHeader title="Lease Details" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={lease.leaseNumber}
        subtitle={lease.tenantName}
        showBack
        action={
          <Link
            href={`/leases/${leaseId}/renew`}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Renew
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">{lease.tenantName}</h2>
              <p className="text-sm text-gray-500">
                {lease.unit && `Unit ${lease.unit}`}
                {lease.unit && lease.property && ' • '}
                {lease.property}
              </p>
            </div>
            <StatusBadge status={lease.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-500">Term</div>
                {lease.startDate && <DateDisplay date={lease.startDate} format="short" />}
                {' → '}
                {lease.endDate && <DateDisplay date={lease.endDate} format="short" />}
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <div>
                <div className="text-xs text-gray-500">Monthly Rent</div>
                <MoneyDisplay amount={lease.monthlyRent} />
              </div>
            </div>
            {(lease.tenantPhone || lease.tenantEmail) && (
              <div className="flex items-center gap-2 text-gray-600 col-span-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs text-gray-500">Contact</div>
                  {lease.tenantPhone && (
                    <a href={`tel:${lease.tenantPhone}`} className="text-primary-600 hover:underline">
                      {lease.tenantPhone}
                    </a>
                  )}
                  {lease.tenantEmail && (
                    <a
                      href={`mailto:${lease.tenantEmail}`}
                      className="block text-primary-600 hover:underline"
                    >
                      {lease.tenantEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {(['overview', 'payments', 'documents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Lease Terms</h3>
            <p className="text-sm text-gray-600">{lease.terms}</p>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Security Deposit</span>
                <span>
                  <MoneyDisplay amount={lease.deposit} />
                  {lease.depositPaid && (
                    <span className="ml-2 text-emerald-600 text-xs">(Paid)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-500">Payment Due Day</span>
                <span>Day {lease.paymentDay} of each month</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-3">
            <Link href="/payments/record" className="btn-primary w-full flex items-center justify-center gap-2">
              <CreditCard className="w-4 h-4" />
              Record Payment
            </Link>
            {loadingPayments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="card divide-y divide-gray-100">
                {paymentHistory.map((payment) => (
                  <div key={payment.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        <MoneyDisplay amount={payment.amount} />
                      </div>
                      <div className="text-xs text-gray-500">
                        Due: <DateDisplay date={payment.dueDate} format="short" />
                        {payment.paidDate && (
                          <> • Paid: <DateDisplay date={payment.paidDate} format="short" /></>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge
                        status={payment.status === 'paid' ? 'paid' : payment.status === 'overdue' ? 'overdue' : 'pending'}
                      />
                      {payment.reference && (
                        <div className="text-xs text-gray-400 mt-1">{payment.reference}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="card p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{doc.name}</div>
                    <div className="text-xs text-gray-500">
                      {doc.type} • <DateDisplay date={doc.uploadedAt} format="short" />
                    </div>
                  </div>
                </div>
                <button className="p-2 rounded-lg hover:bg-gray-100">
                  <Download className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link href="/payments" className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <CreditCard className="w-4 h-4" />
            View All Payments
          </Link>
          <Link href="/payments/invoices" className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" />
            Invoices
          </Link>
        </div>
      </div>
    </>
  );
}
