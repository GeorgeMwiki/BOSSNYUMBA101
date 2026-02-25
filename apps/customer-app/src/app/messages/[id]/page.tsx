'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { ChatBubble } from '@/components/chat/ChatBubble';

const MOCK_MESSAGES = [
  { id: '1', message: 'Hi, I have a question about my maintenance request.', isSent: false, sender: 'Estate Manager', time: '10:30' },
  { id: '2', message: 'Sure! What would you like to know?', isSent: true, time: '10:32' },
  { id: '3', message: 'When will the plumber visit?', isSent: false, sender: 'Estate Manager', time: '10:33' },
  { id: '4', message: 'The plumber is scheduled for tomorrow between 9am-12pm.', isSent: true, time: '10:35' },
];

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const threadId = params.id as string;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-spotify-green border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-[#121212] flex flex-col">
      <PageHeader title="Chat" showBack />
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {MOCK_MESSAGES.map((m) => (
          <ChatBubble
            key={m.id}
            message={m.message}
            isSent={m.isSent}
            sender={m.sender}
            time={m.time}
            isGroup={false}
          />
        ))}
      </div>
    </main>
  );
}
