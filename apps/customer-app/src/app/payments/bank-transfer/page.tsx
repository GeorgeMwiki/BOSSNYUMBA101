'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Copy,
  Check,
  Building2,
  Info,
  Clock,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CURRENT_BALANCE } from '@/lib/payments-data';

interface BankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode?: string;
  swiftCode?: string;
}

const BANK_ACCOUNTS: BankAccount[] = [
  {
    bankName: 'CRDB Bank',
    accountName: 'BOSSNYUMBA Property Ltd',
    accountNumber: '0150123456789',
    branchCode: '015',
    swiftCode: 'CORUTZTZ',
  },
  {
    bankName: 'NMB Bank',
    accountName: 'BOSSNYUMBA Property Ltd',
    accountNumber: '23110012345678',
    branchCode: '231',
    swiftCode: 'NMIBTZTZ',
  },
];

export default function BankTransferPage() {
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const amount = amountParam ? parseInt(amountParam, 10) : CURRENT_BALANCE;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  // Generate unique reference for this payment
  const paymentReference = `BN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const currentBank = BANK_ACCOUNTS[selectedBank];

  return (
    <>
      <PageHeader title="Bank Transfer" showBack />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Amount Card */}
        <div className="card p-5 text-center bg-primary-50 border-primary-100">
          <div className="text-sm text-primary-600">Amount to Transfer</div>
          <div className="text-3xl font-bold text-primary-700">
            KES {amount.toLocaleString()}
          </div>
        </div>

        {/* Bank Selection */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Select Bank</h2>
          <div className="flex gap-2">
            {BANK_ACCOUNTS.map((bank, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedBank(idx)}
                className={`flex-1 card p-3 text-center transition-all ${
                  selectedBank === idx
                    ? 'ring-2 ring-primary-500 bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <Building2 className={`w-5 h-5 mx-auto mb-1 ${
                  selectedBank === idx ? 'text-primary-600' : 'text-gray-400'
                }`} />
                <div className="text-sm font-medium">{bank.bankName}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Bank Details */}
        <section className="card divide-y divide-gray-100">
          <DetailRow
            label="Bank Name"
            value={currentBank.bankName}
            onCopy={() => copyToClipboard(currentBank.bankName, 'bank')}
            copied={copiedField === 'bank'}
          />
          <DetailRow
            label="Account Name"
            value={currentBank.accountName}
            onCopy={() => copyToClipboard(currentBank.accountName, 'name')}
            copied={copiedField === 'name'}
          />
          <DetailRow
            label="Account Number"
            value={currentBank.accountNumber}
            onCopy={() => copyToClipboard(currentBank.accountNumber, 'number')}
            copied={copiedField === 'number'}
            highlight
          />
          {currentBank.branchCode && (
            <DetailRow
              label="Branch Code"
              value={currentBank.branchCode}
              onCopy={() => copyToClipboard(currentBank.branchCode!, 'branch')}
              copied={copiedField === 'branch'}
            />
          )}
          {currentBank.swiftCode && (
            <DetailRow
              label="SWIFT Code"
              value={currentBank.swiftCode}
              onCopy={() => copyToClipboard(currentBank.swiftCode!, 'swift')}
              copied={copiedField === 'swift'}
            />
          )}
        </section>

        {/* Payment Reference - CRITICAL */}
        <section className="card p-4 bg-warning-50 border-warning-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-warning-900 mb-1">
                Important: Include Payment Reference
              </h3>
              <p className="text-sm text-warning-700 mb-3">
                You MUST include this reference in your transfer to ensure automatic matching.
              </p>
              <button
                onClick={() => copyToClipboard(paymentReference, 'ref')}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-warning-300"
              >
                <span className="font-mono text-lg font-bold text-warning-900">
                  {paymentReference}
                </span>
                {copiedField === 'ref' ? (
                  <Check className="w-5 h-5 text-success-600" />
                ) : (
                  <Copy className="w-5 h-5 text-warning-600" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Instructions */}
        <section className="card p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Transfer Instructions
          </h3>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs flex items-center justify-center flex-shrink-0">
                1
              </span>
              <span>Log into your mobile banking or internet banking</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs flex items-center justify-center flex-shrink-0">
                2
              </span>
              <span>Select &quot;Transfer&quot; or &quot;Send Money&quot;</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs flex items-center justify-center flex-shrink-0">
                3
              </span>
              <span>Enter the account details shown above</span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs flex items-center justify-center flex-shrink-0">
                4
              </span>
              <span>
                <strong>Enter the Payment Reference</strong> in the reference/description field
              </span>
            </li>
            <li className="flex gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs flex items-center justify-center flex-shrink-0">
                5
              </span>
              <span>Complete the transfer and save your receipt</span>
            </li>
          </ol>
        </section>

        {/* Processing Time */}
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <Clock className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">Processing Time</p>
            <p>
              Bank transfers typically take 1-2 business days to reflect. You&apos;ll receive
              a confirmation notification once your payment is processed.
            </p>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="card p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">
              I understand that I need to include the payment reference in my bank transfer
              for automatic matching.
            </span>
          </label>
        </div>
      </div>

      {/* Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={() => {
            // Copy all details to clipboard as formatted text
            const details = `
Bank: ${currentBank.bankName}
Account: ${currentBank.accountNumber}
Name: ${currentBank.accountName}
Amount: KES ${amount.toLocaleString()}
Reference: ${paymentReference}
            `.trim();
            navigator.clipboard.writeText(details);
            setCopiedField('all');
            setTimeout(() => setCopiedField(null), 2000);
          }}
          disabled={!confirmed}
          className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {copiedField === 'all' ? (
            <>
              <Check className="w-5 h-5" />
              Details Copied!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copy All Details
            </>
          )}
        </button>
      </div>
    </>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
  copied,
  highlight,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 flex items-center justify-between ${highlight ? 'bg-primary-50' : ''}`}>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`font-medium ${highlight ? 'text-lg font-mono' : ''}`}>{value}</div>
      </div>
      <button
        onClick={onCopy}
        className={`p-2 rounded-lg transition-colors ${
          copied ? 'bg-success-100 text-success-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
