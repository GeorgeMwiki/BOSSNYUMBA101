'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  FileText,
  Download,
  User,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { DateDisplay } from '@/components/DateDisplay';
import { paymentsService } from '@bossnyumba/api-client';

// Fallback data
const fallbackPayment = {
  id: '1',
  reference: 'MPESA-ABC123XYZ',
  amount: 45000,
  method: 'mpesa',
  methodDisplay: 'M-Pesa',
  status: 'paid' as const,
  tenantName: 'John Kamau',
  unit: 'A-204',
  property: 'Sunset Apartments',
  paidAt: '2024-02-28T10:30:00Z',
  invoiceId: '1',
  invoiceNumber: 'INV-2024-003',
  type: 'rent',
  typeLabel: 'Monthly Rent',
  leaseId: '1',
  leaseNumber: 'LSE-2024-001',
};

const methodLabels: Record<string, string> = {
  MPESA: 'M-Pesa',
  mpesa: 'M-Pesa',
  BANK_TRANSFER: 'Bank Transfer',
  bank_transfer: 'Bank Transfer',
  CASH: 'Cash',
  cash: 'Cash',
  CARD: 'Card',
  card: 'Card',
  CHEQUE: 'Cheque',
  cheque: 'Cheque',
};

const typeLabels: Record<string, string> = {
  RENT: 'Monthly Rent',
  rent: 'Monthly Rent',
  DEPOSIT: 'Security Deposit',
  deposit: 'Security Deposit',
  UTILITY: 'Utility Payment',
  utility: 'Utility Payment',
  FEE: 'Fee',
  fee: 'Fee',
  PENALTY: 'Penalty',
  penalty: 'Penalty',
};

const statusMap: Record<string, string> = {
  COMPLETED: 'paid',
  SUCCEEDED: 'paid',
  PAID: 'paid',
  PENDING: 'pending',
  PROCESSING: 'pending',
  REQUIRES_PAYMENT: 'pending',
  FAILED: 'overdue',
  CANCELLED: 'cancelled',
};

interface PaymentDetailProps {
  paymentId: string;
}

export function PaymentDetail({ paymentId }: PaymentDetailProps) {
  const { data: paymentData, isLoading } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => paymentsService.get(paymentId as never),
    retry: false,
  });

  const payment = useMemo(() => {
    const p = paymentData?.data as Record<string, unknown> | undefined;
    if (!p) return fallbackPayment;

    const amount = p.amount as Record<string, unknown> | undefined;
    const customer = p.customer as Record<string, unknown> | undefined;
    const unit = p.unit as Record<string, unknown> | undefined;
    const property = p.property as Record<string, unknown> | undefined;
    const lease = p.lease as Record<string, unknown> | undefined;
    const invoice = p.invoice as Record<string, unknown> | undefined;

    const rawStatus = String(p.status ?? 'PENDING');

    return {
      id: String(p.id ?? paymentId),
      reference: String(p.reference ?? p.externalReference ?? p.id ?? ''),
      amount: Number(amount?.amount ?? p.amount ?? 0),
      method: String(p.channel ?? p.paymentMethod ?? 'mpesa'),
      methodDisplay: methodLabels[String(p.channel ?? p.paymentMethod ?? '')] ?? String(p.channel ?? 'M-Pesa'),
      status: (statusMap[rawStatus] ?? rawStatus.toLowerCase()) as 'paid' | 'pending' | 'overdue',
      tenantName: customer ? String(customer.name ?? '') : '',
      unit: unit ? String(unit.unitNumber ?? '') : '',
      property: property ? String(property.name ?? '') : '',
      paidAt: String(p.paidAt ?? p.completedAt ?? p.updatedAt ?? ''),
      invoiceId: invoice ? String(invoice.id ?? '') : String(p.invoiceId ?? ''),
      invoiceNumber: invoice ? String(invoice.invoiceNumber ?? '') : '',
      type: String(p.paymentType ?? p.type ?? 'rent'),
      typeLabel: typeLabels[String(p.paymentType ?? p.type ?? '')] ?? String(p.paymentType ?? 'Payment'),
      leaseId: lease ? String(lease.id ?? '') : String(p.leaseId ?? ''),
      leaseNumber: lease ? String(lease.leaseNumber ?? '') : '',
    };
  }, [paymentData, paymentId]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Payment Details" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Payment ${payment.reference}`}
        subtitle={payment.status}
        showBack
        action={
          <button className="p-2 rounded-lg hover:bg-gray-100">
            <Download className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="card p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-2xl font-bold">
                <MoneyDisplay amount={payment.amount} />
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {payment.typeLabel}
              </div>
            </div>
            <StatusBadge status={payment.status} />
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Reference</span>
              <span className="font-mono text-xs">{payment.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span>{payment.methodDisplay}</span>
            </div>
            {payment.paidAt && (
              <div className="flex justify-between">
                <span className="text-gray-500">Paid at</span>
                <DateDisplay date={payment.paidAt} format="dateTime" />
              </div>
            )}
          </div>
        </div>

        {(payment.tenantName || payment.unit) && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Tenant & Unit</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-medium">{payment.tenantName || 'Tenant'}</div>
                  <div className="text-sm text-gray-500">
                    {payment.unit && `Unit ${payment.unit}`}
                    {payment.unit && payment.property && ' • '}
                    {payment.property}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {payment.invoiceId && (
          <Link href={`/payments/invoices/${payment.invoiceId}`}>
            <div className="card p-4 flex items-center justify-between hover:border-primary-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium">Linked Invoice</div>
                  <div className="text-sm text-gray-500">{payment.invoiceNumber || payment.invoiceId}</div>
                </div>
              </div>
              <span className="text-primary-600 text-sm">View</span>
            </div>
          </Link>
        )}

        {payment.leaseId && (
          <Link href={`/leases/${payment.leaseId}`}>
            <div className="card p-4 flex items-center justify-between hover:border-primary-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="font-medium">Lease</div>
                  <div className="text-sm text-gray-500">{payment.leaseNumber || payment.leaseId}</div>
                </div>
              </div>
              <span className="text-primary-600 text-sm">View</span>
            </div>
          </Link>
        )}

        <div className="pt-4">
          <h3 className="font-medium mb-3">Receipt</h3>
          <div className="card p-6 border-2 border-dashed border-gray-200 bg-gray-50/50">
            <div className="text-center space-y-2">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Payment Receipt</div>
              <div className="text-2xl font-bold">
                <MoneyDisplay amount={payment.amount} />
              </div>
              <div className="text-sm text-gray-600">{payment.typeLabel}</div>
              <div className="text-xs text-gray-500 font-mono pt-2">{payment.reference}</div>
              {payment.paidAt && (
                <DateDisplay date={payment.paidAt} format="dateTime" className="block text-sm text-gray-500" />
              )}
              <button className="btn-primary mt-4 text-sm">
                <Download className="w-4 h-4 mr-2 inline" />
                Download Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
