import React, { useState } from 'react';
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
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  type: 'email' | 'sms';
  subject: string;
  category: string;
  lastUpdated: string;
  usageCount: number;
}

const templates: Template[] = [
  {
    id: '1',
    name: 'Rent Reminder',
    type: 'email',
    subject: 'Rent payment due - {{property}}',
    category: 'Billing',
    lastUpdated: '2025-01-15',
    usageCount: 3420,
  },
  {
    id: '2',
    name: 'Payment Confirmation',
    type: 'email',
    subject: 'Payment received - {{amount}}',
    category: 'Billing',
    lastUpdated: '2025-01-10',
    usageCount: 8900,
  },
  {
    id: '3',
    name: 'Welcome New Tenant',
    type: 'email',
    subject: 'Welcome to {{property}}',
    category: 'Onboarding',
    lastUpdated: '2025-01-05',
    usageCount: 1240,
  },
  {
    id: '4',
    name: 'Maintenance Alert',
    type: 'sms',
    subject: 'Urgent: Maintenance scheduled',
    category: 'Operations',
    lastUpdated: '2025-01-12',
    usageCount: 560,
  },
  {
    id: '5',
    name: 'Lease Renewal',
    type: 'email',
    subject: 'Your lease is expiring soon',
    category: 'Leasing',
    lastUpdated: '2024-12-20',
    usageCount: 432,
  },
  {
    id: '6',
    name: 'OTP Verification',
    type: 'sms',
    subject: 'Your verification code: {{code}}',
    category: 'Security',
    lastUpdated: '2025-01-01',
    usageCount: 15200,
  },
];

export default function CommunicationsTemplatesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
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
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Edit className="h-4 w-4 text-gray-500" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
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

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No templates found
        </div>
      )}
    </div>
  );
}
