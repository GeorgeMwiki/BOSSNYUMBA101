'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { CreditCard, Loader2, AlertCircle, Check } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { paymentsApi } from '@/lib/api';
import { customersService } from '@bossnyumba/api-client';

const paymentSchema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  invoiceId: z.string().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  method: z.enum(['CASH', 'MPESA', 'BANK_TRANSFER', 'CHEQUE', 'CARD']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  receivedAt: z.string().min(1, 'Select a date'),
});

type FormState = {
  customerId: string;
  invoiceId: string;
  amount: string;
  method: 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';
  reference: string;
  notes: string;
  receivedAt: string;
};

export default function ReceivePaymentPage() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState<FormState>({
    customerId: '',
    invoiceId: '',
    amount: '',
    method: 'MPESA',
    reference: '',
    notes: '',
    receivedAt: new Date().toISOString().slice(0, 10),
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-payment'],
    queryFn: () => customersService.list({ pageSize: 100 }),
    retry: false,
  });

  const customers = customersQuery.data?.data ?? [];

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c: any) => {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
      return (
        name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const invoicesQuery = useQuery({
    queryKey: ['customer-open-invoices', formData.customerId],
    queryFn: () => paymentsApi.listInvoicesForCustomer(formData.customerId),
    enabled: Boolean(formData.customerId),
    retry: false,
  });

  const openInvoices = invoicesQuery.data?.data ?? [];

  const recordMutation = useMutation({
    mutationFn: () =>
      paymentsApi.record({
        customerId: formData.customerId,
        invoiceId: formData.invoiceId || undefined,
        amount: Number(formData.amount),
        method: formData.method,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
        receivedAt: formData.receivedAt,
      }),
    onSuccess: (resp: any) => {
      if (resp?.success === false) {
        setErrors({ form: resp.error?.message ?? 'Failed to record payment' });
      } else {
        router.push('/payments');
      }
    },
    onError: (err) => {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to record payment' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = paymentSchema.safeParse({
      ...formData,
      amount: Number(formData.amount),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    recordMutation.mutate();
  };

  return (
    <>
      <PageHeader title="Receive Payment" showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {errors.form && (
          <div className="card p-3 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{errors.form}</div>
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <CreditCard className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold">Record a payment</h2>
              <p className="text-sm text-gray-500">
                Register manual cash, M-Pesa, bank, cheque or card payments received from tenants.
              </p>
            </div>
          </div>

          <div>
            <label className="label">Customer</label>
            <input
              type="text"
              placeholder="Search customer..."
              className="input mb-3"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {customersQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading customers...
              </div>
            )}
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {filteredCustomers.map((c: any) => {
                const name =
                  [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, customerId: c.id, invoiceId: '' })}
                    className={`w-full p-3 rounded-lg text-left border transition-colors ${
                      formData.customerId === c.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium">{name}</div>
                    {c.phone && <div className="text-sm text-gray-500">{c.phone}</div>}
                  </button>
                );
              })}
            </div>
            {errors.customerId && (
              <p className="text-xs text-danger-600 mt-1">{errors.customerId}</p>
            )}
          </div>

          {formData.customerId && (
            <div>
              <label className="label">Invoice (optional)</label>
              {invoicesQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading invoices...
                </div>
              ) : openInvoices.length === 0 ? (
                <p className="text-sm text-gray-500">No open invoices for this customer.</p>
              ) : (
                <select
                  className="input"
                  value={formData.invoiceId}
                  onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                >
                  <option value="">Unallocated</option>
                  {openInvoices.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — KES {inv.amountDue.toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (KES)</label>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                className="input"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
              {errors.amount && <p className="text-xs text-danger-600 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="label">Method</label>
              <select
                className="input"
                value={formData.method}
                onChange={(e) =>
                  setFormData({ ...formData, method: e.target.value as FormState['method'] })
                }
              >
                <option value="MPESA">M-Pesa</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Reference</label>
              <input
                type="text"
                className="input"
                placeholder="Transaction ref, cheque #, etc."
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Received At</label>
              <input
                type="date"
                className="input"
                value={formData.receivedAt}
                onChange={(e) => setFormData({ ...formData, receivedAt: e.target.value })}
              />
              {errors.receivedAt && (
                <p className="text-xs text-danger-600 mt-1">{errors.receivedAt}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[80px]"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link href="/payments" className="btn-secondary flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={recordMutation.isPending}
          >
            {recordMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Record Payment
          </button>
        </div>
      </form>
    </>
  );
}
