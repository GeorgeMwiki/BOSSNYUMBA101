'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  DollarSign,
  Clock,
  FileText,
  Send,
  CreditCard,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { invoicesService, paymentsService } from '@bossnyumba/api-client';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(amount / 100);
}

function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-TZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CollectionDetailPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesService.get(invoiceId),
    retry: false,
  });

  const { data: paymentHistory } = useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: () => paymentsService.list({ page: 1, pageSize: 50 }),
    retry: false,
  });

  const payments = paymentHistory?.data ?? [];
  const inv = invoice?.data ?? invoice;

  if (isLoading) {
    return (
      <>
        <PageHeader title="Collection Detail" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  if (!inv) {
    return (
      <>
        <PageHeader title="Collection Detail" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Invoice not found</div>
      </>
    );
  }

  const amountOwed = (inv.totalAmount ?? 0) - (inv.paidAmount ?? 0);
  const daysOverdue = inv.daysOverdue ?? 0;

  return (
    <>
      <PageHeader title="Collection Detail" showBack />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Amount Due Card */}
        <div className="card p-5 bg-red-50 border-red-200">
          <div className="text-center">
            <div className="text-sm text-red-600 font-medium">Amount Owed</div>
            <div className="text-3xl font-bold text-red-700 mt-1">{formatCurrency(amountOwed)}</div>
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-red-500">
              <Clock className="w-4 h-4" />
              {daysOverdue} days overdue
            </div>
          </div>
        </div>

        {/* Customer & Property Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Customer</span>
            </div>
            <div className="font-medium">{inv.customerName ?? 'Unknown'}</div>
            <div className="text-sm text-gray-500">{inv.customerPhone ?? ''}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Property</span>
            </div>
            <div className="font-medium">{inv.propertyName ?? 'Unknown'}</div>
            <div className="text-sm text-gray-500">{inv.unitName ?? ''}</div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Invoice Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice Number</span>
              <span className="font-medium">{inv.invoiceNumber ?? inv.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Amount</span>
              <span className="font-medium">{formatCurrency(inv.totalAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Paid Amount</span>
              <span className="font-medium text-green-600">{formatCurrency(inv.paidAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Due Date</span>
              <span className="font-medium">{formatDate(inv.dueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="badge-warning text-xs">{inv.status ?? 'overdue'}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Actions</h3>
          <div className="grid grid-cols-1 gap-2">
            <button className="card p-4 hover:shadow-md transition-shadow flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Send className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Send Payment Demand</div>
                  <div className="text-sm text-gray-500">Send notice with timeframe for compliance</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="card p-4 hover:shadow-md transition-shadow flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Create Payment Plan</div>
                  <div className="text-sm text-gray-500">Arrange installment schedule</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
            <button className="card p-4 hover:shadow-md transition-shadow flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Escalate Case</div>
                  <div className="text-sm text-gray-500">Create a formal dispute case</div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Payment History */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Payment History
          </h3>
          {payments.length === 0 ? (
            <div className="card p-4 text-center text-sm text-gray-500">No payments recorded</div>
          ) : (
            <div className="space-y-2">
              {payments.slice(0, 10).map((payment: { id: string; amount?: number; paidAt?: string; method?: string; status?: string }) => (
                <div key={payment.id} className="card p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{formatCurrency(payment.amount ?? 0)}</div>
                    <div className="text-xs text-gray-500">{formatDate(payment.paidAt)} • {payment.method ?? 'GePG'}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    payment.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {payment.status ?? 'pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
