'use client';

import Link from 'next/link';
import { Users, FileText, Calendar, MessageSquare, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function CommunityBoardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-card flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-surface-card rounded" />
              <div className="h-3 w-3/4 bg-surface-card rounded" />
              <div className="h-3 w-1/4 bg-surface-card rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  const { data: conversations, isLoading, isError, refetch } = useQuery<any[]>(
    '/messaging/conversations?pageSize=10',
    { staleTime: 30_000 }
  );

  const conversationList = Array.isArray(conversations) ? conversations : [];

  return (
    <>
      <PageHeader title="Community" showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Quick Links */}
        <section>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/community/rules"
              className="card p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
            >
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <div className="font-medium text-sm text-white">Property Rules</div>
                <div className="text-xs text-gray-400">Building guidelines</div>
              </div>
            </Link>
            <Link
              href="/announcements"
              className="card p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
            >
              <div className="p-2 bg-primary-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <div className="font-medium text-sm text-white">Announcements</div>
                <div className="text-xs text-gray-400">Property updates</div>
              </div>
            </Link>
          </div>
        </section>

        {/* Community Board */}
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Community Board
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Connect with neighbors—share updates, ask questions, or help out.
          </p>

          {isLoading && <CommunityBoardSkeleton />}

          {isError && (
            <div className="card p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <p className="text-gray-400 mb-3">Unable to load community posts</p>
              <button onClick={() => refetch()} className="btn-secondary text-sm">
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && conversationList.length > 0 && (
            <div className="space-y-3">
              {conversationList.map((convo: any) => (
                <Link key={convo.id} href={`/messages/${convo.id}`} className="card p-4 block">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-white">
                          {convo.participants?.find((p: any) => p.type === 'manager')?.name || convo.subject || 'Conversation'}
                        </span>
                        {convo.subject && (
                          <>
                            <span className="text-xs text-gray-500">·</span>
                            <span className="text-xs text-gray-400">{convo.subject}</span>
                          </>
                        )}
                      </div>
                      {(convo.lastMessage || convo.content) && (
                        <p className="text-sm text-gray-400 mt-1 truncate">
                          {convo.lastMessage?.content || convo.content || ''}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {(convo.updatedAt || convo.createdAt) && (
                          <span>{formatTimeAgo(convo.updatedAt || convo.createdAt)}</span>
                        )}
                        {(convo.unreadCount || 0) > 0 && (
                          <span className="bg-primary-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                            {convo.unreadCount} new
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!isLoading && !isError && conversationList.length === 0 && (
            <div className="card p-8 text-center">
              <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 mb-1">No posts yet</p>
              <p className="text-sm text-gray-500">
                Be the first to share with the community
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
