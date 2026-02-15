import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, UserCheck, AlertTriangle, CheckCircle, Clock, ChevronRight, TrendingUp } from 'lucide-react';

interface ComplianceItem {
  id: string;
  tenant: string;
  type: string;
  status: 'compliant' | 'pending' | 'non_compliant' | 'expiring';
  lastReview: string;
  nextReview: string;
  score: number;
}

const mockItems: ComplianceItem[] = [
  { id: '1', tenant: 'Acme Properties Ltd', type: 'KYC Verification', status: 'compliant', lastReview: '2026-01-15', nextReview: '2026-07-15', score: 95 },
  { id: '2', tenant: 'Sunrise Realty', type: 'Data Protection', status: 'compliant', lastReview: '2026-01-20', nextReview: '2026-07-20', score: 88 },
  { id: '3', tenant: 'Metro Housing', type: 'KYC Verification', status: 'pending', lastReview: '2026-02-01', nextReview: '2026-02-28', score: 60 },
  { id: '4', tenant: 'Coastal Estates', type: 'Business License', status: 'expiring', lastReview: '2025-08-10', nextReview: '2026-02-20', score: 72 },
  { id: '5', tenant: 'Highland Properties', type: 'Data Protection', status: 'compliant', lastReview: '2026-01-05', nextReview: '2026-07-05', score: 92 },
];

const statusColors: Record<string, string> = {
  compliant: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  non_compliant: 'bg-red-100 text-red-700',
  expiring: 'bg-orange-100 text-orange-700',
};

export default function CompliancePage() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? mockItems : mockItems.filter((i) => i.status === filter);
  const compliantCount = mockItems.filter((i) => i.status === 'compliant').length;
  const avgScore = Math.round(mockItems.reduce((s, i) => s + i.score, 0) / mockItems.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor regulatory compliance across tenants</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/compliance/documents" className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <FileText className="h-4 w-4" />Documents
          </Link>
          <Link to="/compliance/data-requests" className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <UserCheck className="h-4 w-4" />Data Requests
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold text-gray-900">{compliantCount}/{mockItems.length}</p><p className="text-sm text-gray-500">Compliant</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-amber-100 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-gray-900">{mockItems.filter((i) => i.status === 'pending').length}</p><p className="text-sm text-gray-500">Pending Review</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-orange-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-orange-600" /></div><div><p className="text-2xl font-bold text-gray-900">{mockItems.filter((i) => i.status === 'expiring').length}</p><p className="text-sm text-gray-500">Expiring Soon</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><TrendingUp className="h-5 w-5 text-violet-600" /></div><div><p className="text-2xl font-bold text-gray-900">{avgScore}%</p><p className="text-sm text-gray-500">Avg Score</p></div></div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {['all', 'compliant', 'pending', 'expiring', 'non_compliant'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 text-sm font-medium rounded-lg ${filter === s ? 'bg-violet-100 text-violet-700' : 'text-gray-600 hover:bg-gray-100'}`}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Review</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.tenant}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.type}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[item.status]}`}>{item.status.replace('_', ' ')}</span></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2"><div className="w-16 bg-gray-200 rounded-full h-2"><div className={`h-2 rounded-full ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.score}%` }} /></div><span className="text-sm text-gray-700">{item.score}%</span></div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{item.nextReview}</td>
                <td className="px-6 py-4 text-right"><button className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1 ml-auto">Review<ChevronRight className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
