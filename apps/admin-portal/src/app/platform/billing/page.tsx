import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';

interface Invoice {
  id: string;
  tenant: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  date: string;
  dueDate: string;
  plan: string;
}

const mockInvoices: Invoice[] = [
  { id: 'INV-2026-001', tenant: 'Acme Properties Ltd', amount: 125000, status: 'paid', date: '2026-02-01', dueDate: '2026-02-15', plan: 'Enterprise' },
  { id: 'INV-2026-002', tenant: 'Sunrise Realty', amount: 45000, status: 'paid', date: '2026-02-01', dueDate: '2026-02-15', plan: 'Professional' },
  { id: 'INV-2026-003', tenant: 'Metro Housing', amount: 0, status: 'pending', date: '2026-02-01', dueDate: '2026-02-15', plan: 'Trial' },
  { id: 'INV-2026-004', tenant: 'Coastal Estates', amount: 15000, status: 'overdue', date: '2026-01-01', dueDate: '2026-01-15', plan: 'Starter' },
  { id: 'INV-2026-005', tenant: 'Highland Properties', amount: 95000, status: 'paid', date: '2026-02-01', dueDate: '2026-02-15', plan: 'Enterprise' },
];

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function PlatformBillingPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = mockInvoices.filter((inv) => {
    const matchesSearch = inv.tenant.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = mockInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pendingAmount = mockInvoices.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage platform billing and subscription invoices</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">KES {(totalRevenue / 1000).toFixed(0)}K</p>
              <p className="text-sm text-gray-500">Collected This Month</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">KES {(pendingAmount / 1000).toFixed(0)}K</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg"><CreditCard className="h-5 w-5 text-violet-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{mockInvoices.length}</p>
              <p className="text-sm text-gray-500">Total Invoices</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">96%</p>
              <p className="text-sm text-gray-500">Collection Rate</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.id}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{inv.tenant}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.plan}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">KES {inv.amount.toLocaleString()}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[inv.status]}`}>{inv.status}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
