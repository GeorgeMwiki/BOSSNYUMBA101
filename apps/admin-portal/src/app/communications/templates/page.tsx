import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Copy,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface Template {
  id: string;
  name: string;
  type: 'email' | 'sms';
  subject: string;
  category: string;
  lastUpdated: string;
  usageCount: number;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-56 bg-gray-200 rounded" />
          <div className="h-4 w-72 bg-gray-200 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>
      <div className="flex gap-4">
        <div className="flex-1 h-10 bg-gray-200 rounded-lg" />
        <div className="w-32 h-10 bg-gray-200 rounded-lg" />
        <div className="w-28 h-10 bg-gray-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="flex gap-1">
                <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                <div className="w-8 h-8 bg-gray-200 rounded-lg" />
              </div>
            </div>
            <div className="h-5 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-48 bg-gray-200 rounded mt-2" />
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div className="h-5 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommunicationsTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<Template[]>('/communications/templates');
    if (res.success && res.data) {
      setTemplates(res.data);
    } else {
      setError(res.error || 'Failed to load templates');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Failed to Load Templates</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchTemplates}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Email & SMS Templates
          </h1>
          <p className="text-gray-500">
            Manage communication templates across tenants
          </p>
        </div>
        <button
          onClick={() => navigate('/communications/templates/new')}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All Types</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          Category
        </button>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`p-2 rounded-lg ${
                    template.type === 'email' ? 'bg-blue-100' : 'bg-green-100'
                  }`}
                >
                  {template.type === 'email' ? (
                    <Mail className="h-5 w-5 text-blue-600" />
                  ) : (
                    <MessageSquare className="h-5 w-5 text-green-600" />
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/communications/templates/${template.id}/edit`)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => navigate(`/communications/templates/${template.id}/copy`)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <Copy className="h-4 w-4 text-gray-500" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <MoreVertical className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              <p className="text-sm text-gray-500 mt-1 truncate">
                {template.subject}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                  {template.category}
                </span>
                <span className="text-xs text-gray-500">
                  {template.usageCount.toLocaleString()} uses
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Updated {new Date(template.lastUpdated).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Templates Yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            Create your first email or SMS template to get started with automated communications.
          </p>
          <button
            onClick={() => navigate('/communications/templates/new')}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No templates match your search
        </div>
      )}
    </div>
  );
}
