'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export function BillingPage() {
  const {
    data: invoices,
    isLoading: loadingInvoices,
    error: invoicesError,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices');
      if (res.success && res.data) return res.data;
      throw new Error(res.error || 'Failed to load invoices');
    },
    staleTime: 30_000,
  });

  const {
    data: payments,
    isLoading: loadingPayments,
    error: paymentsError,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const res = await api.get('/payments');
      if (res.success && res.data) return res.data;
      throw new Error(res.error || 'Failed to load payments');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingInvoices || loadingPayments;
  const error = invoicesError || paymentsError;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-56" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div className="h-7 bg-gray-200 rounded w-24 mt-4" />
              <div className="h-3 bg-gray-200 rounded w-28" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-36" />
          <div className="h-8 bg-gray-200 rounded w-48" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="h-5 bg-gray-200 rounded w-32" />
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-28" />
              <div className="h-5 bg-gray-200 rounded-full w-16" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="p-4 bg-amber-50 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Billing Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load billing data. Please check your connection and try again.'}
        </p>
        <button
          onClick={() => { refetchInvoices(); refetchPayments(); }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const paymentList = Array.isArray(payments) ? payments : [];

  const totalInvoiced = invoiceList.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
  const totalCollected = paymentList.reduce((sum: number, pmt: any) => sum + (pmt.amount || 0), 0);
  const outstanding = totalInvoiced - totalCollected;
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Revenue dashboard and billing operations</p>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-violet-100 rounded-lg">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{invoiceList.length}</p>
            <p className="text-sm text-gray-500">Total Invoices</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">TZS {totalInvoiced.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Invoiced</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">TZS {totalCollected.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Collected</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{collectionRate}%</p>
            <p className="text-sm text-gray-500">Collection Rate</p>
          </div>
        </div>
      </div>

      {/* Outstanding */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-2">Outstanding Balance</h3>
        <p className="text-3xl font-bold text-red-600">TZS {outstanding.toLocaleString()}</p>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Invoices</h3>
        </div>
        {invoiceList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 bg-gray-100 rounded-full mb-3">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No Invoices Yet</h3>
            <p className="text-sm text-gray-500 max-w-sm">Invoices will appear here once billing activity begins.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoiceList.slice(0, 10).map((invoice: any) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {invoice.invoiceNumber || invoice.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    TZS {(invoice.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      invoice.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
