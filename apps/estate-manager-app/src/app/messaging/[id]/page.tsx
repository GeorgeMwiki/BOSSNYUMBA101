'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send, User } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface Message {
  id: string;
  sender: string;
  senderRole: 'tenant' | 'manager' | 'maintenance';
  content: string;
  sentAt: string;
}

// Live wiring pending — conversations endpoint not yet mounted.
// Empty map keeps the UI honest until the messaging service is plumbed.
const conversationData: Record<string, { subject: string; participants: string[]; messages: Message[] }> = {};

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;
  const [newMessage, setNewMessage] = useState('');

  const conversation = conversationData[id];

  if (!conversation) {
    return (
      <>
        <PageHeader title="Conversation" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-500 mb-4">Conversation not found</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    // In real app: API call to send message
    setNewMessage('');
  };

  return (
    <>
      <PageHeader
        title={conversation.subject}
        subtitle={conversation.participants.join(', ')}
        showBack
      />

      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {conversation.messages.map((msg) => {
            const isOwn = msg.senderRole === 'manager' || msg.senderRole === 'maintenance';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <div className={`flex-1 max-w-[80%] ${isOwn ? 'items-end' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1">{msg.sender}</div>
                  <div
                    className={`p-3 rounded-xl ${
                      isOwn ? 'bg-primary-100 text-primary-900 ml-auto' : 'bg-gray-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(msg.sentAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              className="input flex-1"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={!newMessage.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
