import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  HeadphonesIcon,
  Search,
  Filter,
  MessageSquare,
  Clock,
  User,
  Tag,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Send,
  Paperclip,
  Users,
  ArrowUp,
  Eye,
} from 'lucide-react';
import { formatDateTime } from '../lib/api';

interface SupportCase {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  tenant: string;
  requester: {
    name: string;
    email: string;
  };
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    sender: string;
    message: string;
    timestamp: string;
    isInternal: boolean;
  }>;
}

// Live wiring pending — admin support ticket endpoints not yet mounted.
// Production rendering falls back to an empty list rather than demo tickets.
const cases: SupportCase[] = [];

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-amber-100', text: 'text-amber-700' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600' },
  high: { bg: 'bg-amber-100', text: 'text-amber-600' },
  critical: { bg: 'bg-red-100', text: 'text-red-600' },
};

export function SupportPage() {
  const t = useTranslations('supportPage');
  const [selectedCase, setSelectedCase] = useState<SupportCase | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.tenant.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/support/timeline" className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Users className="h-4 w-4" />
            {t('customerTimeline')}
          </Link>
          <Link to="/support/escalation" className="flex items-center gap-2 px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 text-sm font-medium">
            <ArrowUp className="h-4 w-4" />
            {t('escalationQueue')}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{t('stats.open')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {cases.filter((c) => c.status === 'open').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">{t('stats.inProgress')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {cases.filter((c) => c.status === 'in_progress').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{t('stats.critical')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {cases.filter((c) => c.priority === 'critical').length}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{t('stats.resolvedToday')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">5</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">{t('statusFilter.all')}</option>
              <option value="open">{t('statusFilter.open')}</option>
              <option value="in_progress">{t('statusFilter.inProgress')}</option>
              <option value="resolved">{t('statusFilter.resolved')}</option>
              <option value="closed">{t('statusFilter.closed')}</option>
            </select>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {filteredCases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedCase?.id === c.id ? 'bg-violet-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">
                        {c.ticketNumber}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          priorityColors[c.priority].bg
                        } ${priorityColors[c.priority].text}`}
                      >
                        {c.priority}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">
                      {c.subject}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{c.tenant}</p>
                  </div>
                  <span
                    className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${
                      statusColors[c.status].bg
                    } ${statusColors[c.status].text}`}
                  >
                    {c.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {formatDateTime(c.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Case Detail */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {selectedCase ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-500">
                        {selectedCase.ticketNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          statusColors[selectedCase.status].bg
                        } ${statusColors[selectedCase.status].text}`}
                      >
                        {selectedCase.status.replace('_', ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                          priorityColors[selectedCase.priority].bg
                        } ${priorityColors[selectedCase.priority].text}`}
                      >
                        {selectedCase.priority}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedCase.subject}
                    </h2>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <MoreVertical className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {selectedCase.requester.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Tag className="h-4 w-4" />
                    {selectedCase.category}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {t('caseDetail.createdAt', { date: formatDateTime(selectedCase.createdAt) })}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    {selectedCase.description}
                  </p>
                </div>

                {selectedCase.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.isInternal ? 'bg-amber-50 rounded-lg p-3' : ''
                    }`}
                  >
                    <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-violet-600">
                        {msg.sender
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {msg.sender}
                        </span>
                        {msg.isInternal && (
                          <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                            {t('caseDetail.internal')}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatDateTime(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('reply.placeholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          {t('reply.internalNote')}
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <select className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                          <option value="open">{t('reply.keepOpen')}</option>
                          <option value="in_progress">{t('reply.markInProgress')}</option>
                          <option value="resolved">{t('reply.markResolved')}</option>
                          <option value="closed">{t('reply.closeTicket')}</option>
                        </select>
                        <button className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">
                          <Send className="h-4 w-4" />
                          {t('reply.send')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <HeadphonesIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('empty.selectTicket')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
