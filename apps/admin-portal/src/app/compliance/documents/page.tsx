/**
 * ComplianceDocumentsPage — library of uploaded compliance documents.
 *
 * Assumed backend endpoints:
 *   GET   /compliance/documents?category=<any|policy|soc2|iso|gdpr>&search=<q>
 *         -> { data: { items: ComplianceDocument[], total: number } }
 *   PATCH /compliance/documents/:id  (body: { status: DocStatus })
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api, formatDate } from '../../../lib/api';

type DocCategory = 'policy' | 'soc2' | 'iso' | 'gdpr' | 'other';
type DocStatus = 'draft' | 'under_review' | 'approved' | 'expired';

interface ComplianceDocument {
  id: string;
  title: string;
  category: DocCategory;
  version: string;
  status: DocStatus;
  owner: string;
  updatedAt: string;
  expiresAt: string | null;
  url?: string;
}

interface DocumentsListResponse {
  items: ComplianceDocument[];
  total: number;
}

const statusBadge: Record<DocStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  under_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
};

export default function ComplianceDocumentsPage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<'any' | DocCategory>('any');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ category });
    if (search) qs.set('search', search);
    api
      .get<DocumentsListResponse>(`/compliance/documents?${qs.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setDocs(res.data.items);
          setTotal(res.data.total);
        } else {
          setError(res.error ?? 'Failed to load documents.');
          setDocs([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [category, search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} document{total === 1 ? '' : 's'} in the library.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDocs}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh documents"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or owner"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as 'any' | DocCategory)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">All categories</option>
          <option value="policy">Policy</option>
          <option value="soc2">SOC 2</option>
          <option value="iso">ISO 27001</option>
          <option value="gdpr">GDPR</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Search
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchDocs}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <FileText className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No documents match these filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {d.url ? (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-violet-700 hover:underline"
                      >
                        {d.title}
                      </a>
                    ) : (
                      <span className="font-medium text-gray-900">{d.title}</span>
                    )}
                    <div className="text-xs text-gray-500">v{d.version}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{d.category.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[d.status]}`}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{d.owner}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(d.updatedAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {d.expiresAt ? formatDate(d.expiresAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
