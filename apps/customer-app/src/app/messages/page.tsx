'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { MessageCircle } from 'lucide-react';

const MOCK_THREADS = [
  { id: '1', name: 'Estate Manager', lastMessage: 'Your maintenance request has been scheduled.', time: '2h ago', unread: true },
  { id: '2', name: 'Sunrise Apartments', lastMessage: 'Pool maintenance completed.', time: '5h ago', unread: false },
  { id: '3', name: 'Billing Support', lastMessage: 'Receipt for payment #1234', time: 'Yesterday', unread: false },
];

export default function MessagesPage() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/auth/login';
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-spotify-green border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-[#121212]">
      <PageHeader title="Messages" />
      <div className="px-4 py-4 pb-24">
        {MOCK_THREADS.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <MessageCircle className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-gray-400 text-center">No messages yet</p>
            <p className="text-gray-500 text-sm text-center mt-1">Chat with your estate manager or support</p>
          </div>
        ) : (
          <div className="space-y-1">
            {MOCK_THREADS.map((t) => (
              <Link
                key={t.id}
                href={`/messages/${t.id}`}
                className="flex items-center gap-4 p-4 rounded-spotify bg-surface-card hover:bg-surface-hover transition-colors"
              >
                <div className="w-12 h-12 rounded-story bg-spotify-green flex items-center justify-center flex-shrink-0">
                  <span className="text-black font-semibold">{t.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold truncate ${t.unread ? 'text-white' : 'text-gray-300'}`}>{t.name}</p>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{t.time}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">{t.lastMessage}</p>
                </div>
                {t.unread && (
                  <div className="w-2 h-2 rounded-story bg-spotify-green flex-shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
