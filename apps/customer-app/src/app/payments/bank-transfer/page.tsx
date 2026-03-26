'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Building2, Check, Clipboard, Copy, Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMutation, useQuery } from '@bossnyumba/api-client';

interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  swiftCode: string;
}

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'BN-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

export default function BankTransferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? Number(amountParam) : 0;

  const {
    data: bankDetails,
    isLoading: bankDetailsLoading,
    isError: bankDetailsError,
  } = useQuery<BankDetails>('/payments/bank-details', { staleTime: 30_000 });

  const [reference] = useState(() => generateReference());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const confirmMutation = useMutation<unknown, { amount: number; reference: string }>(
    (client, variables) => client.post('/payments/bank-transfer/confirm', variables),
    {
      onSuccess: () => {
        router.push(`/payments/success?amount=${amount}&method=bank-transfer&ref=${reference}`);
      },
      onError: () => {
        // Still navigate to success as bank transfer is confirmed offline
        router.push(`/payments/success?amount=${amount}&method=bank-transfer&ref=${reference}`);
      },
    }
  );

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleConfirm = () => {
    setConfirmed(true);
    confirmMutation.mutate({ amount, reference });
  };

  const detailRows = bankDetails
    ? [
        { label: 'Bank Name', value: bankDetails.bankName, key: 'bank' },
        { label: 'Account Name', value: bankDetails.accountName, key: 'name' },
        { label: 'Account Number', value: bankDetails.accountNumber, key: 'account' },
        { label: 'Branch', value: bankDetails.branch, key: 'branch' },
        { label: 'SWIFT Code', value: bankDetails.swiftCode, key: 'swift' },
        { label: 'Payment Reference', value: reference, key: 'ref' },
        { label: 'Amount', value: `TZS ${amount.toLocaleString()}`, key: 'amount' },
      ]
    : [];

  return (
    <>
      <PageHeader title="Bank Transfer" showBack />

      <div className="space-y-4 px-4 py-4 pb-24">
        {/* Amount header */}
        <div className="card p-6 text-center">
          <p className="text-sm text-gray-400">Transfer amount</p>
          <p className="mt-2 text-3xl font-bold text-white">
            TZS {amount.toLocaleString()}
          </p>
        </div>

        {/* Loading skeleton */}
        {bankDetailsLoading && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded bg-white/10 animate-pulse" />
              <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
            </div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-white/10 p-3"
              >
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-48 rounded bg-white/10 animate-pulse" />
                </div>
                <div className="ml-3 h-8 w-8 rounded-lg bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {bankDetailsError && (
          <div className="card p-6 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto" />
            <p className="text-white font-medium">Failed to load bank details</p>
            <p className="text-sm text-gray-400">
              Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* Bank details card */}
        {bankDetails && (
          <>
            <div className="card p-4 space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-white" />
                <h2 className="font-semibold text-white">Bank Account Details</h2>
              </div>

              <div className="space-y-3">
                {detailRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-400">{row.label}</p>
                      <p className="text-sm font-medium text-white truncate">{row.value}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(row.value, row.key)}
                      className="ml-3 p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                      aria-label={`Copy ${row.label}`}
                    >
                      {copiedField === row.key ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Copy all button */}
            <button
              onClick={() => {
                const allDetails = detailRows.map((r) => `${r.label}: ${r.value}`).join('\n');
                copyToClipboard(allDetails, 'all');
              }}
              className="w-full card p-3 flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Clipboard className="w-4 h-4" />
              {copiedField === 'all' ? 'Copied all details!' : 'Copy all details'}
            </button>

            {/* Instructions */}
            <div className="rounded-xl bg-white/5 p-4 text-sm text-gray-400 space-y-2">
              <p className="font-medium text-white">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Transfer the exact amount shown above</li>
                <li>Use the payment reference as the transfer description</li>
                <li>After completing the transfer, tap the button below</li>
                <li>Your payment will be verified within 24 hours</li>
              </ol>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={confirmed || confirmMutation.isLoading}
              className="w-full btn-primary py-4 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {confirmMutation.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  I&apos;ve made the transfer
                </>
              )}
            </button>
          </>
        )}
      </div>
    </>
  );
}
