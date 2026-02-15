'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Smartphone,
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface Payment {
  id: string;
  type: 'rent' | 'utilities' | 'deposit' | 'late_fee' | 'refund';
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'processing' | 'failed';
  dueDate: string;
  paidDate?: string;
  channel?: string;
  reference?: string;
}

const MOCK_PAYMENTS: Payment[] = [
  {
    id: '1',
    type: 'rent',
    amount: 40000,
    status: 'pending',
    dueDate: '2024-03-01',
  },
  {
    id: '2',
    type: 'utilities',
    amount: 3500,
    status: 'overdue',
    dueDate: '2024-02-28',
  },
  {
    id: '3',
    type: 'rent',
    amount: 40000,
    status: 'paid',
    dueDate: '2024-02-01',
    paidDate: '2024-01-30',
    channel: 'M-Pesa',
    reference: 'QJK2PL94TM',
  },
  {
    id: '4',
    type: 'utilities',
    amount: 2800,
    status: 'paid',
    dueDate: '2024-01-28',
    paidDate: '2024-01-28',
    channel: 'M-Pesa',
    reference: 'RNM8KL32WX',
  },
  {
    id: '5',
    type: 'deposit',
    amount: 80000,
    status: 'paid',
    dueDate: '2023-06-01',
    paidDate: '2023-05-28',
    channel: 'Bank Transfer',
    reference: 'DEP-2023-0528',
  },
];

const statusConfig = {
  paid: { label: 'Paid', icon: CheckCircle, color: 'badge-success', textColor: 'text-success-600' },
  pending: { label: 'Pending', icon: Clock, color: 'badge-warning', textColor: 'text-warning-600' },
  overdue: { label: 'Overdue', icon: AlertCircle, color: 'badge-danger', textColor: 'text-danger-600' },
  processing: { label: 'Processing', icon: Clock, color: 'badge-info', textColor: 'text-primary-600' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'badge-danger', textColor: 'text-danger-600' },
};

const typeLabels: Record<string, string> = {
  rent: 'Monthly Rent',
  utilities: 'Utilities',
  deposit: 'Security Deposit',
  late_fee: 'Late Fee',
  refund: 'Refund',
};

const CURRENT_BALANCE = 43500;

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid'>('all');
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  const pendingPayments = MOCK_PAYMENTS.filter(
    (p) => p.status === 'pending' || p.status === 'overdue'
  );
  const paidPayments = MOCK_PAYMENTS.filter((p) => p.status === 'paid');
  
  const filteredPayments = 
    activeTab === 'pending' ? pendingPayments :
    activeTab === 'paid' ? paidPayments :
    MOCK_PAYMENTS;

  return (
    <>
      <PageHeader
        title="Payments"
        action={
          <Link href="/payments/history" className="p-2 rounded-lg hover:bg-gray-100">
            <Receipt className="w-5 h-5" />
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Balance Card */}
        <div className="card overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm opacity-90">Current Balance Due</span>
              {pendingPayments.length > 0 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                  {pendingPayments.length} pending
                </span>
              )}
            </div>
            <div className="text-4xl font-bold mb-6">
              KES {CURRENT_BALANCE.toLocaleString()}
            </div>
            
            {/* M-Pesa Button - Primary CTA */}
            <button
              onClick={() => setShowPaymentMethods(true)}
              className="w-full bg-[#4CAF50] hover:bg-[#43A047] text-white rounded-xl py-4 px-4 flex items-center justify-center gap-3 font-semibold text-lg transition-colors active:scale-[0.98]"
            >
              <Smartphone className="w-6 h-6" />
              Pay with M-Pesa
            </button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex border-t border-gray-100">
            <Link
              href="/payments/bank-transfer"
              className="flex-1 py-4 flex flex-col items-center gap-1 hover:bg-gray-50 transition-colors border-r border-gray-100"
            >
              <Building2 className="w-5 h-5 text-gray-500" />
              <span className="text-xs text-gray-600">Bank Transfer</span>
            </Link>
            <Link
              href="/payments/history"
              className="flex-1 py-4 flex flex-col items-center gap-1 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-5 h-5 text-gray-500" />
              <span className="text-xs text-gray-600">Statements</span>
            </Link>
          </div>
        </div>

        {/* Payment Breakdown */}
        {pendingPayments.length > 0 && (
          <div className="card p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Balance Breakdown</h3>
            <div className="space-y-3">
              {pendingPayments.map((payment) => {
                const status = statusConfig[payment.status];
                return (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        payment.status === 'overdue' ? 'bg-danger-500' : 'bg-warning-500'
                      }`} />
                      <span className="text-sm">{typeLabels[payment.type]}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">KES {payment.amount.toLocaleString()}</span>
                      {payment.status === 'overdue' && (
                        <span className="text-xs text-danger-600 block">Overdue</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['all', 'pending', 'paid'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'pending' ? 'Pending' : 'Paid'}
            </button>
          ))}
        </div>

        {/* Payment History */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500">
              {activeTab === 'all' ? 'All Transactions' : 
               activeTab === 'pending' ? 'Pending Payments' : 'Payment History'}
            </h2>
            <span className="text-xs text-gray-400">{filteredPayments.length} items</span>
          </div>
          
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
            
            {filteredPayments.length === 0 && (
              <div className="card p-8 text-center text-gray-500">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>No {activeTab === 'pending' ? 'pending' : ''} payments found</p>
              </div>
            )}
          </div>
        </section>

        <Link
          href="/payments/history"
          className="block text-center text-sm text-primary-600 py-4"
        >
          View Full History →
        </Link>
      </div>

      {/* M-Pesa Payment Modal */}
      {showPaymentMethods && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-4 animate-slide-up safe-area-bottom">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Pay with M-Pesa</h3>
              <button
                onClick={() => setShowPaymentMethods(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="card p-4 bg-[#4CAF50]/10 border-[#4CAF50]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-[#4CAF50] rounded-xl flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold">M-Pesa STK Push</h4>
                  <p className="text-sm text-gray-600">Instant payment to your phone</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-semibold">KES {CURRENT_BALANCE.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Phone Number</span>
                  <span className="font-medium">+254 7XX XXX XXX</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 text-center">
              You will receive an M-Pesa prompt on your phone to complete the payment.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentMethods(false)}
                className="btn-secondary flex-1 py-4"
              >
                Cancel
              </button>
              <Link
                href="/payments/mpesa"
                className="btn-primary flex-1 py-4 bg-[#4CAF50] hover:bg-[#43A047]"
                onClick={() => setShowPaymentMethods(false)}
              >
                Continue
              </Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}

function PaymentCard({ payment }: { payment: Payment }) {
  const status = statusConfig[payment.status];
  const StatusIcon = status.icon;
  const isCredit = payment.type === 'refund';

  return (
    <Link href={`/payments/invoice/${payment.id}`}>
      <div className="card p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isCredit ? 'bg-success-50' : 'bg-gray-100'
          }`}>
            {isCredit ? (
              <ArrowDownRight className="w-5 h-5 text-success-600" />
            ) : (
              <ArrowUpRight className="w-5 h-5 text-gray-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{typeLabels[payment.type]}</div>
                <div className="text-sm text-gray-500">
                  {payment.status === 'paid' && payment.paidDate
                    ? `Paid ${new Date(payment.paidDate).toLocaleDateString()}`
                    : `Due ${new Date(payment.dueDate).toLocaleDateString()}`}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${isCredit ? 'text-success-600' : ''}`}>
                  {isCredit ? '+' : ''}KES {payment.amount.toLocaleString()}
                </div>
                <span className={status.color}>
                  <StatusIcon className="w-3 h-3 mr-1 inline" />
                  {status.label}
                </span>
              </div>
            </div>
            {payment.reference && (
              <div className="text-xs text-gray-400 mt-2">
                Ref: {payment.reference} • {payment.channel}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
