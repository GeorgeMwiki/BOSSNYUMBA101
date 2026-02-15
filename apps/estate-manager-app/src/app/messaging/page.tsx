'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, MessageCircle, ChevronRight, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type ConversationStatus = 'unread' | 'read';

interface Conversation {
  id: string;
  subject: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
  preview: string;
}

// Mock data - replace with API
const conversations: Conversation[] = [
  {
    id: '1',
    subject: 'Water leak in Unit A-301',
    participants: ['Maintenance Team', 'Mary Wanjiku'],
    lastMessage: 'The plumber has been scheduled for tomorrow.',
    lastMessageAt: '2024-02-25T10:30:00',
    status: 'unread',
    preview: 'Thanks for the update. I\'ll be home in the afternoon.',
  },
  {
    id: '2',
    subject: 'Lease renewal - Unit B-105',
    participants: ['Peter Ochieng', 'Property Manager'],
    lastMessage: 'Please find the renewal documents attached.',
    lastMessageAt: '2024-02-24T14:20:00',
    status: 'read',
    preview: 'I\'ve reviewed the terms. When can we sign?',
  },
  {
    id: '3',
    subject: 'Rent payment confirmation',
    participants: ['Grace Muthoni'],
    lastMessage: 'Payment received. Receipt #REC-2024-4521',
    lastMessageAt: '2024-02-24T09:15:00',
    status: 'read',
    preview: 'Thank you for your prompt payment.',
  },
];

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MessagingPage() {
  const [search, setSearch] = useState('');

  const filteredConversations = conversations.filter(
    (c) =>
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.participants.some((p) => p.toLowerCase().includes(search.toLowerCase()))
  );

  const unreadCount = conversations.filter((c) => c.status === 'unread').length;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        action={
          <Link href="/messaging/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            New
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          {filteredConversations.map((conv) => (
            <Link key={conv.id} href={`/messaging/${conv.id}`}>
              <div
                className={`card p-4 hover:shadow-md transition-shadow ${
                  conv.status === 'unread' ? 'border-l-4 border-l-primary-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${conv.status === 'unread' ? 'text-gray-900' : 'text-gray-700'}`}>
                        {conv.subject}
                      </span>
                      {conv.status === 'unread' && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {conv.participants.join(', ')}
                    </div>
                    <div className="text-sm text-gray-600 mt-2 truncate">
                      {conv.lastMessage}
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(conv.lastMessageAt)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-400 mt-2" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredConversations.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No conversations</h3>
            <p className="text-sm text-gray-500 mt-1">
              {search ? 'No conversations match your search' : 'Start a new conversation'}
            </p>
            {!search && (
              <Link href="/messaging/new" className="btn-primary mt-4 inline-block">
                New Message
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
