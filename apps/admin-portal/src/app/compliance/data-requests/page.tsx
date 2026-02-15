import React, { useState } from 'react';
import { UserCheck, Search, Clock, CheckCircle, AlertTriangle, Eye, Download, User } from 'lucide-react';

interface DataRequest {
  id: string;
  type: 'access' | 'deletion' | 'portability' | 'rectification';
  requester: string;
  email: string;
  tenant: string;
  status: 'pending' | 'in_progress' | 'completed' | 'denied';
  createdAt: string;
  deadline: string;
  assignee: string;
}

const mockRequests: DataRequest[] = [
  { id: 'DR-001', type: 'access', requester: 'James Omondi', email: 'james@tenant.co.ke', tenant: 'Acme Properties', status: 'in_progress', createdAt: '2026-02-10', deadline: '2026-03-10', assignee: 'Support Team' },
  { id: 'DR-002', type: 'deletion', requester: 'Sarah Wambui', email: 'sarah@tenant.co.ke', tenant: 'Sunrise Realty', status: 'pending', createdAt: '2026-02-12', deadline: '2026-03-12', assignee: 'Unassigned' },
  { id: 'DR-003', type: 'portability', requester: 'Peter Njoroge', email: 'peter@tenant.co.ke', tenant: 'Highland Properties', status: 'completed', createdAt: '2026-01-20', deadline: '2026-02-20', assignee: 'Support Team' },
  { id: 'DR-004', type: 'rectification', requester: 'Mary Akinyi', email: 'mary@tenant.co.ke', tenant: 'Metro Housing', status: 'completed', createdAt: '2026-01-15', deadline: '2026-02-15', assignee: 'Support Team' },
];

const statusColors: Record<string, string> = { pending: 'bg-amber-100 text-amber-700', in_progress: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', denied: 'bg-red-100 text-red-700' };
const typeColors: Record<string, string> = { access: 'bg-blue-100 text-blue-700', deletion: 'bg-red-100 text-red-700', portability: 'bg-violet-100 text-violet-700', rectification: 'bg-amber-100 text-amber-700' };

export default function ComplianceDataRequestsPage() {
  const [search, setSearch] = useState('');
  const filtered = mockRequests.filter((r) => r.requester.toLowerCase().includes(search.toLowerCase()) || r.tenant.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Subject Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Handle GDPR/Data Protection Act requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2"><Clock className="h-4 w-4" /><span className="text-sm font-medium">Pending</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockRequests.filter((r) => r.status === 'pending').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-medium">In Progress</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockRequests.filter((r) => r.status === 'in_progress').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2"><CheckCircle className="h-4 w-4" /><span className="text-sm font-medium">Completed</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockRequests.filter((r) => r.status === 'completed').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2"><UserCheck className="h-4 w-4" /><span className="text-sm font-medium">Total</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockRequests.length}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((req) => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{req.id}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[req.type]}`}>{req.type}</span></td>
                <td className="px-6 py-4"><div><p className="text-sm font-medium text-gray-900">{req.requester}</p><p className="text-xs text-gray-500">{req.email}</p></div></td>
                <td className="px-6 py-4 text-sm text-gray-600">{req.tenant}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[req.status]}`}>{req.status.replace('_', ' ')}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{req.deadline}</td>
                <td className="px-6 py-4 text-right"><button className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"><Eye className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
