'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Search, Check, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ReceivePaymentPage() {
  const router = useRouter();
  const [step, setStep] = useState<'search' | 'details' | 'confirm' | 'success'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mockCustomers = [
    { id: 'cust-001', name: 'Jane Smith', unit: 'A1 - Masaki Heights', balance: 800000 },
    { id: 'cust-002', name: 'Peter Ochieng', unit: 'B3 - Masaki Heights', balance: 1200000 },
    { id: 'cust-003', name: 'Grace Kimaro', unit: 'C2 - Masaki Heights', balance: 400000 },
  ];

  const filteredCustomers = searchQuery.length >= 2
    ? mockCustomers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.unit.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const customer = mockCustomers.find(c => c.id === selectedCustomer);

  const handleSubmit = async () => {
    setSubmitting(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000));
    setStep('success');
    setSubmitting(false);
  };

  return (
    <>
      <PageHeader title="Receive Payment" showBack />

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {step === 'search' && (
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Find Customer</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or unit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            {filteredCustomers.length > 0 && (
              <div className="divide-y divide-gray-100">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c.id); setStep('details'); setAmount(String(c.balance)); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg"
                  >
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.unit}</p>
                    <p className="text-sm text-red-600 font-medium">Balance: TZS {c.balance.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && filteredCustomers.length === 0 && (
              <p className="text-center text-gray-500 py-4">No customers found</p>
            )}
          </div>
        )}

        {step === 'details' && customer && (
          <div className="card p-6 space-y-5">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">{customer.name}</p>
              <p className="text-sm text-gray-500">{customer.unit}</p>
              <p className="text-sm text-red-600 font-medium mt-1">Outstanding: TZS {customer.balance.toLocaleString()}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (TZS)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                {['cash', 'bank_transfer', 'cheque', 'mpesa'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium ${
                      paymentMethod === method
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Receipt Number</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. REC-2024-001"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('search')} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
                Back
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!amount || Number(amount) <= 0}
                className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && customer && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">Please confirm the payment details below</p>
            </div>

            <div className="divide-y divide-gray-100">
              <div className="py-3 flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium">{customer.name}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-500">Unit</span>
                <span className="font-medium">{customer.unit}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-lg">TZS {Number(amount).toLocaleString()}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-medium">{paymentMethod.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
              {reference && (
                <div className="py-3 flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="font-medium">{reference}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('details')} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Recorded</h2>
            <p className="text-gray-500 mb-6">
              TZS {Number(amount).toLocaleString()} has been recorded for {customer?.name}.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setStep('search'); setSearchQuery(''); setSelectedCustomer(null); setAmount(''); setReference(''); }}
                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Record Another
              </button>
              <button onClick={() => router.push('/payments')} className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
                View Payments
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
