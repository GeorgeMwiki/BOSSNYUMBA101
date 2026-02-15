'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, CreditCard, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Mock invoice data - would come from API
const invoices: Record<
  string,
  {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: string;
    dueDate: string;
    paidDate?: string;
    lineItems: { description: string; amount: number; quantity?: number }[];
    property: string;
    unit: string;
    createdAt: string;
    channel?: string;
    reference?: string;
  }
> = {
  '1': {
    id: '1',
    invoiceNumber: 'INV-2024-0301',
    amount: 45000,
    status: 'pending',
    dueDate: '2024-03-01',
    lineItems: [
      { description: 'Monthly Rent - March 2024', amount: 40000, quantity: 1 },
      { description: 'Service Charge', amount: 3000, quantity: 1 },
      { description: 'Water Bill', amount: 2000, quantity: 1 },
    ],
    property: 'Sunset Apartments',
    unit: 'A-204',
    createdAt: '2024-02-15',
  },
  '2': {
    id: '2',
    invoiceNumber: 'INV-2024-0201',
    amount: 45000,
    status: 'paid',
    dueDate: '2024-02-01',
    paidDate: '2024-01-28',
    channel: 'M-Pesa',
    reference: 'MPESA-ABC123XYZ',
    lineItems: [
      { description: 'Monthly Rent - February 2024', amount: 40000, quantity: 1 },
      { description: 'Service Charge', amount: 3000, quantity: 1 },
      { description: 'Water Bill', amount: 2000, quantity: 1 },
    ],
    property: 'Sunset Apartments',
    unit: 'A-204',
    createdAt: '2024-01-15',
  },
  '3': {
    id: '3',
    invoiceNumber: 'INV-2024-0101',
    amount: 45000,
    status: 'paid',
    dueDate: '2024-01-01',
    paidDate: '2023-12-30',
    channel: 'M-Pesa',
    reference: 'MPESA-DEF456UVW',
    lineItems: [
      { description: 'Monthly Rent - January 2024', amount: 40000, quantity: 1 },
      { description: 'Service Charge', amount: 3000, quantity: 1 },
      { description: 'Water Bill', amount: 2000, quantity: 1 },
    ],
    property: 'Sunset Apartments',
    unit: 'A-204',
    createdAt: '2023-12-15',
  },
  '4': {
    id: '4',
    invoiceNumber: 'INV-2023-0601',
    amount: 90000,
    status: 'paid',
    dueDate: '2023-06-01',
    paidDate: '2023-05-28',
    channel: 'Bank Transfer',
    reference: 'BANK-GHI789RST',
    lineItems: [{ description: 'Security Deposit', amount: 90000, quantity: 1 }],
    property: 'Sunset Apartments',
    unit: 'A-204',
    createdAt: '2023-05-20',
  },
  '5': {
    id: '5',
    invoiceNumber: 'INV-2023-1201',
    amount: 45000,
    status: 'failed',
    dueDate: '2023-12-01',
    lineItems: [
      { description: 'Monthly Rent - December 2023', amount: 40000, quantity: 1 },
      { description: 'Service Charge', amount: 3000, quantity: 1 },
      { description: 'Water Bill', amount: 2000, quantity: 1 },
    ],
    property: 'Sunset Apartments',
    unit: 'A-204',
    createdAt: '2023-11-15',
  },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'badge-success' },
  pending: { label: 'Pending', color: 'badge-warning' },
  overdue: { label: 'Overdue', color: 'badge-danger' },
  failed: { label: 'Failed', color: 'badge-danger' },
  processing: { label: 'Processing', color: 'badge-info' },
};

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const invoice = invoices[id] || invoices['1'];

  if (!invoice) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-gray-600">Invoice not found</p>
        <button onClick={() => router.back()} className="btn-primary mt-4">
          Go Back
        </button>
      </div>
    );
  }

  const status = statusConfig[invoice.status] || statusConfig.pending;
  const canPay = invoice.status === 'pending' || invoice.status === 'overdue' || invoice.status === 'failed';

  return (
    <>
      <PageHeader title="Invoice" showBack />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Invoice Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500">{invoice.invoiceNumber}</div>
              <h2 className="text-lg font-semibold mt-1">{invoice.property}</h2>
              <div className="text-sm text-gray-500">{invoice.unit}</div>
            </div>
            <span className={status.color}>{status.label}</span>
          </div>
          <div className="text-2xl font-bold text-primary-600">
            KES {invoice.amount.toLocaleString()}
          </div>
        </div>

        {/* Line Items */}
        <section className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Invoice Details
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {invoice.lineItems.map((item, index) => (
              <div key={index} className="p-4 flex justify-between">
                <div>
                  <div className="font-medium">{item.description}</div>
                  {item.quantity && item.quantity > 1 && (
                    <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                  )}
                </div>
                <div className="font-medium">KES {item.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>KES {invoice.amount.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Payment Info for paid invoices */}
        {invoice.status === 'paid' && invoice.paidDate && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Payment Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Paid on</span>
                <span>{new Date(invoice.paidDate).toLocaleDateString()}</span>
              </div>
              {invoice.channel && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Method</span>
                  <span>{invoice.channel}</span>
                </div>
              )}
              {invoice.reference && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference</span>
                  <span className="font-mono text-xs">{invoice.reference}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {canPay && (
            <Link href={`/payments/pay?amount=${invoice.amount}`}>
              <button className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                Pay this Invoice
              </button>
            </Link>
          )}
          <button
            onClick={() => window.print()}
            className="btn-secondary w-full py-4 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </div>
      </div>
    </>
  );
}
