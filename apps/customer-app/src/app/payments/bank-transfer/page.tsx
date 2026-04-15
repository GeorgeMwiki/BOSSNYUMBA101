'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Building2, Check, Copy, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const schema = z.object({
  amount: z.number().int().positive('Amount is required'),
  bank: z.string().min(1, 'Select which bank you used'),
  referenceNumber: z.string().min(4, 'Enter the bank reference number'),
  transferDate: z.string().min(1, 'Enter the transfer date'),
  notes: z.string().optional(),
});

export default function BankTransferPage() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialAmount = Number(searchParams.get('amount') ?? '0');

  const instructionsQuery = useQuery({
    queryKey: ['bank-transfer-instructions'],
    queryFn: () => api.payments.getBankTransferInstructions(),
  });

  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [bank, setBank] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const confirm = useMutation({
    mutationFn: () => {
      const parsed = schema.parse({
        amount: Number(amount),
        bank,
        referenceNumber,
        transferDate,
        notes,
      });
      return api.payments.confirmBankTransfer(parsed);
    },
    onSuccess: (result) => {
      toast.success('Bank transfer submitted for verification');
      router.replace(
        `/payments/success?paymentId=${result.id}&amount=${encodeURIComponent(
          amount
        )}&method=bank`
      );
    },
    onError: (err) => {
      if (err instanceof z.ZodError) {
        setFieldError(err.issues[0]?.message ?? 'Please check your input');
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Failed to confirm transfer',
        'Submission failed'
      );
    },
  });

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <>
      <PageHeader title="Bank Transfer" showBack />

      <div className="space-y-5 px-4 py-4 pb-24">
        <div className="card flex items-start gap-3 p-4">
          <div className="rounded-xl bg-blue-500/10 p-3">
            <Building2 className="h-6 w-6 text-blue-300" />
          </div>
          <div>
            <div className="font-semibold text-white">Transfer instructions</div>
            <p className="text-sm text-gray-400">
              Please use the reference below when making your transfer so we can match your
              payment correctly.
            </p>
          </div>
        </div>

        {instructionsQuery.isLoading && (
          <div className="card flex items-center gap-2 p-4 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading instructions...
          </div>
        )}

        {instructionsQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {(instructionsQuery.error as Error).message}
          </div>
        )}

        {instructionsQuery.data && (
          <>
            <div className="card p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400">
                Payment reference
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="font-mono text-lg text-white">
                  {instructionsQuery.data.paymentReference}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy('ref', instructionsQuery.data!.paymentReference)
                  }
                  className="btn-secondary flex items-center gap-1 text-xs"
                >
                  {copiedKey === 'ref' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {instructionsQuery.data.banks.map((b, idx) => (
                <div key={`${b.bankName}-${idx}`} className="card p-4">
                  <div className="font-semibold text-white">{b.bankName}</div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-gray-400">Account name</dt>
                    <dd className="text-gray-100">{b.accountName}</dd>
                    <dd />
                    <dt className="text-gray-400">Account number</dt>
                    <dd className="font-mono text-gray-100">{b.accountNumber}</dd>
                    <dd>
                      <button
                        type="button"
                        onClick={() => handleCopy(`acct-${idx}`, b.accountNumber)}
                        className="btn-secondary flex items-center gap-1 px-2 py-1 text-xs"
                      >
                        {copiedKey === `acct-${idx}` ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </dd>
                    {b.branch && (
                      <>
                        <dt className="text-gray-400">Branch</dt>
                        <dd className="text-gray-100">{b.branch}</dd>
                        <dd />
                      </>
                    )}
                    {b.swift && (
                      <>
                        <dt className="text-gray-400">SWIFT</dt>
                        <dd className="font-mono text-gray-100">{b.swift}</dd>
                        <dd />
                      </>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          </>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFieldError(null);
            confirm.mutate();
          }}
          className="card space-y-3 p-4"
        >
          <div className="font-semibold text-white">Confirm your transfer</div>

          <div>
            <label className="label" htmlFor="amount">
              Amount (KES)
            </label>
            <input
              id="amount"
              type="number"
              min={1}
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="bank">
              Bank used
            </label>
            <select
              id="bank"
              className="input"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              required
            >
              <option value="">Select a bank</option>
              {(instructionsQuery.data?.banks ?? []).map((b) => (
                <option key={b.bankName} value={b.bankName}>
                  {b.bankName}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="reference">
              Bank reference / transaction ID
            </label>
            <input
              id="reference"
              type="text"
              className="input"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="transferDate">
              Transfer date
            </label>
            <input
              id="transferDate"
              type="date"
              className="input"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="notes">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {fieldError && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              {fieldError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={confirm.isPending}
          >
            {confirm.isPending ? 'Submitting...' : 'Confirm transfer'}
          </button>
        </form>
      </div>
    </>
  );
}
