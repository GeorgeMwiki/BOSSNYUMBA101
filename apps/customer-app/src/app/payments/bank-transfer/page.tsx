'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Building2, Check, Clipboard, Copy, Loader2, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useMutation } from '@bossnyumba/api-client';

const BANK_DETAILS = {
  bankName: 'CRDB Bank',
  accountName: 'BossNyumba Properties Ltd',
  accountNumber: '0150823456001',
  branch: 'Dar es Salaam Main Branch',
  swiftCode: 'CORUTZTZ',
};

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

  const detailRows = [
    { label: 'Bank Name', value: BANK_DETAILS.bankName, key: 'bank' },
    { label: 'Account Name', value: BANK_DETAILS.accountName, key: 'name' },
    { label: 'Account Number', value: BANK_DETAILS.accountNumber, key: 'account' },
    { label: 'Branch', value: BANK_DETAILS.branch, key: 'branch' },
    { label: 'SWIFT Code', value: BANK_DETAILS.swiftCode, key: 'swift' },
    { label: 'Payment Reference', value: reference, key: 'ref' },
    { label: 'Amount', value: `TZS ${amount.toLocaleString()}`, key: 'amount' },
  ];

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

        {/* Bank details card */}
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
      </div>
    </>
  );
}
