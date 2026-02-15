'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  CreditCard,
  Download,
  User,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { DateDisplay } from '@/components/DateDisplay';
import { invoicesService } from '@bossnyumba/api-client';

// Fallback data
const fallbackInvoice = {
  id: '1',
  invoiceNumber: 'INV-2024-010',
  tenantName: 'John Kamau',
  unit: 'A-204',
  property: 'Sunset Apartments',
  leaseId: '1',
  leaseNumber: 'LSE-2024-001',
  amount: 45000,
  status: 'paid' as const,
  dueDate: '2024-03-01',
  paidDate: '2024-02-28',
  period: 'March 2024',
  lineItems: [{ description: 'Monthly Rent - March 2024', amount: 45000 }],
  payments: [{ id: '1', amount: 45000, reference: 'MPESA-ABC123', paidAt: '2024-02-28T10:30:00Z' }],
  totalPaid: 45000,
  balance: 0,
};

const statusMap: Record<string, string> = {
  PAID: 'paid',
  PARTIALLY_PAID: 'pending',
  PENDING: 'pending',
  SENT: 'pending',
  DRAFT: 'pending',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

interface InvoiceDetailProps {
  invoiceId: string;
}

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesService.get(invoiceId),
    retry: false,
  });

  const invoice = useMemo(() => {
    const inv = invoiceData?.data as Record<string, unknown> | undefined;
    if (!inv) return fallbackInvoice;

    const customer = inv.customer as Record<string, unknown> | undefined;
    const unit = inv.unit as Record<string, unknown> | undefined;
    const property = inv.property as Record<string, unknown> | undefined;
    const lineItems = inv.lineItems as Array<Record<string, unknown>> | undefined;
    const payments = inv.payments as Array<Record<string, unknown>> | undefined;

    const rawStatus = String(inv.status ?? 'PENDING');
    const total = Number(inv.total ?? inv.subtotal ?? 0);
    const amountPaid = Number(inv.amountPaid ?? 0);

    const periodStart = inv.periodStart ? new Date(String(inv.periodStart)) : null;
    const period = periodStart
      ? periodStart.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
      : '';

    const mappedLineItems = lineItems?.map((li) => ({
      description: String(li.description ?? ''),
      amount: Number(li.total ?? li.unitPrice ?? 0),
    })) ?? [{ description: 'Invoice total', amount: total }];

    const mappedPayments = payments?.map((p) => ({
      id: String(p.id ?? ''),
      amount: Number(p.amount ?? (p as Record<string, unknown>).amount ?? 0),
      reference: String(p.reference ?? p.externalReference ?? ''),
      paidAt: String(p.paidAt ?? p.completedAt ?? ''),
    })) ?? [];

    return {
      id: String(inv.id ?? invoiceId),
      invoiceNumber: String(inv.number ?? inv.invoiceNumber ?? inv.id ?? ''),
      tenantName: customer ? String(customer.name ?? '') : '',
      unit: unit ? String(unit.unitNumber ?? '') : '',
      property: property ? String(property.name ?? '') : '',
      leaseId: String(inv.leaseId ?? ''),
      leaseNumber: '',
      amount: total,
      status: (statusMap[rawStatus] ?? rawStatus.toLowerCase()) as 'paid' | 'pending' | 'overdue',
      dueDate: String(inv.dueDate ?? ''),
      paidDate: rawStatus === 'PAID' ? String(inv.updatedAt ?? '') : '',
      period,
      lineItems: mappedLineItems,
      payments: mappedPayments,
      totalPaid: amountPaid,
      balance: Math.max(0, total - amountPaid),
    };
  }, [invoiceData, invoiceId]);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Invoice Details" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={invoice.status}
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
                <MoneyDisplay amount={invoice.amount} />
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Due: <DateDisplay date={invoice.dueDate} format="short" />
              </div>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          {invoice.paidDate && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm">
              <CheckCircle className="w-4 h-4" />
              Paid on <DateDisplay date={invoice.paidDate} format="short" />
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="font-medium mb-3">Tenant & Lease</h3>
          <div className="space-y-2 text-sm">
            {invoice.tenantName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                {invoice.tenantName}
              </div>
            )}
            {(invoice.unit || invoice.property) && (
              <div className="flex items-center gap-2 text-gray-500">
                {invoice.unit && `Unit ${invoice.unit}`}
                {invoice.unit && invoice.property && ' • '}
                {invoice.property}
              </div>
            )}
            {invoice.leaseId && (
              <Link href={`/leases/${invoice.leaseId}`} className="flex items-center gap-2 text-primary-600 hover:underline">
                <FileText className="w-4 h-4" />
                {invoice.leaseNumber || `Lease ${invoice.leaseId}`}
              </Link>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-medium mb-3">Line Items</h3>
          <div className="divide-y divide-gray-100">
            {invoice.lineItems.map((item, i) => (
              <div key={i} className="py-3 flex justify-between">
                <span className="text-sm">{item.description}</span>
                <span className="font-medium">
                  <MoneyDisplay amount={item.amount} />
                </span>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-gray-200 flex justify-between font-semibold">
            <span>Total</span>
            <MoneyDisplay amount={invoice.amount} />
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-medium mb-3">Payment Breakdown</h3>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded</p>
          ) : (
            <div className="space-y-3">
              {invoice.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <div className="font-medium">
                      <MoneyDisplay amount={p.amount} />
                    </div>
                    {p.reference && <div className="text-xs text-gray-500 font-mono">{p.reference}</div>}
                    {p.paidAt && (
                      <div className="text-xs text-gray-500">
                        <DateDisplay date={p.paidAt} format="dateTime" />
                      </div>
                    )}
                  </div>
                  <StatusBadge status="paid" />
                </div>
              ))}
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Amount Paid</span>
                <MoneyDisplay amount={invoice.totalPaid} />
              </div>
              {invoice.balance > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Balance Due</span>
                  <MoneyDisplay amount={invoice.balance} />
                </div>
              )}
            </div>
          )}
        </div>

        {invoice.balance > 0 && (
          <Link href="/payments/record" className="btn-primary w-full flex items-center justify-center gap-2">
            <CreditCard className="w-4 h-4" />
            Record Payment
          </Link>
        )}
      </div>
    </>
  );
}
