'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoicesService, paymentsService } from '@bossnyumba/api-client';
import {
  CreditCard,
  DollarSign,
  FileText,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';

export default function PlatformBillingPage() {
  const {
    data: invoices,
    isLoading: loadingInvoices,
    error: invoicesError,
  } = useQuery({
    queryKey: ['admin-platform-billing-invoices'],
    queryFn: async () => {
      const res = await invoicesService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load invoices');
    },
    staleTime: 30_000,
  });

  const {
    data: payments,
    isLoading: loadingPayments,
    error: paymentsError,
  } = useQuery({
    queryKey: ['admin-platform-billing-payments'],
    queryFn: async () => {
      const res = await paymentsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load payments');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingInvoices || loadingPayments;
  const error = invoicesError || paymentsError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Billing Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load platform billing data.'}
        </p>
      </div>
    );
  }

  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const paymentList = Array.isArray(payments) ? payments : [];

  const totalInvoiced = invoiceList.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
  const totalCollected = paymentList.reduce((sum: number, pmt: any) => sum + (pmt.amount || 0), 0);
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">Platform billing and subscription invoices</p>
      </div>

      {/* Billing Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <FileText className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{invoiceList.length}</p>
            <p className="text-sm text-gray-500">Total Invoices</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">TZS {totalInvoiced.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Invoiced</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <CreditCard className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">TZS {totalCollected.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Collected</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <TrendingUp className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{collectionRate}%</p>
            <p className="text-sm text-gray-500">Collection Rate</p>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Invoices</h3>
        </div>
        {invoiceList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No invoices found</div>
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
              {invoiceList.slice(0, 10).map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {inv.invoiceNumber || inv.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    TZS {(inv.amount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}
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
