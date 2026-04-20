import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Users,
  Building2,
  Search,
} from 'lucide-react';
import { Skeleton, Alert, AlertDescription, Button, EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '../../../lib/api';
import { useTenantCommunications } from '../../../lib/hooks';

export default function TenantCommunicationsPage() {
  const t = useTranslations('tenantCommunicationsPage');
  const { data: conversations = [], isLoading, error, refetch } = useTenantCommunications();
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(
    (c) =>
      c.tenantName?.toLowerCase().includes(search.toLowerCase()) ||
      c.propertyName?.toLowerCase().includes(search.toLowerCase())
  );

  // No fixture fallback — real empty state when the tenant has no conversations yet.
  const displayConversations = filtered;

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load tenant communications'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">{t('retry')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={t('searchConversations')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {displayConversations.length === 0 ? (
        <EmptyState
          title={search ? t('emptySearchTitle') : t('emptyTitle')}
          description={
            search
              ? t('emptySearchDescription')
              : t('emptyDescription')
          }
        />
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {displayConversations.map((conv) => (
            <Link
              key={conv.id}
              to={`/tenants/${conv.tenantId}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 truncate">{conv.tenantName}</h4>
                    {conv.unreadCount && conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="h-4 w-4 flex-shrink-0" />
                    {conv.propertyName} • {t('unit')} {conv.unitNumber}
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">{conv.lastMessage}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 pl-4">
                <span className="text-xs text-gray-500">
                  {formatDateTime(conv.lastMessageAt)}
                </span>
                <MessageSquare className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-medium text-blue-800">{t('sendMessage')}</p>
            <p className="text-sm text-blue-700">
              {t('sendMessageHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
