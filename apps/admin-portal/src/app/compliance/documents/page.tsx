import React, { useState } from 'react';
import { FileText, Search, Upload, Download, Eye, Trash2, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface ComplianceDocument {
  id: string;
  name: string;
  tenant: string;
  type: string;
  status: 'approved' | 'pending_review' | 'expired' | 'rejected';
  uploadedAt: string;
  expiresAt: string;
  uploadedBy: string;
}

const mockDocuments: ComplianceDocument[] = [
  { id: '1', name: 'Business Registration Certificate', tenant: 'Acme Properties', type: 'KYC', status: 'approved', uploadedAt: '2026-01-10', expiresAt: '2027-01-10', uploadedBy: 'john@acme.co.ke' },
  { id: '2', name: 'Tax Compliance Certificate', tenant: 'Sunrise Realty', type: 'Tax', status: 'approved', uploadedAt: '2026-01-15', expiresAt: '2026-12-31', uploadedBy: 'mary@sunrise.co.ke' },
  { id: '3', name: 'KRA PIN Certificate', tenant: 'Metro Housing', type: 'KYC', status: 'pending_review', uploadedAt: '2026-02-05', expiresAt: '2027-02-05', uploadedBy: 'peter@metro.co.ke' },
  { id: '4', name: 'Insurance Certificate', tenant: 'Coastal Estates', type: 'Insurance', status: 'expired', uploadedAt: '2025-02-01', expiresAt: '2026-02-01', uploadedBy: 'fatma@coastal.co.ke' },
  { id: '5', name: 'Data Protection Registration', tenant: 'Highland Properties', type: 'GDPR', status: 'approved', uploadedAt: '2026-01-20', expiresAt: '2027-01-20', uploadedBy: 'david@highland.co.ke' },
];

const statusColors: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending_review: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ComplianceDocumentsPage() {
  const [search, setSearch] = useState('');
  const filtered = mockDocuments.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.tenant.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Manage tenant compliance documentation</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"><Upload className="h-4 w-4" />Upload Document</button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-gray-400" /><div><p className="text-sm font-medium text-gray-900">{doc.name}</p><p className="text-xs text-gray-500">Uploaded {doc.uploadedAt}</p></div></div></td>
                <td className="px-6 py-4 text-sm text-gray-700">{doc.tenant}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{doc.type}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[doc.status]}`}>{doc.status.replace('_', ' ')}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{doc.expiresAt}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"><Eye className="h-4 w-4" /></button>
                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Download className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
