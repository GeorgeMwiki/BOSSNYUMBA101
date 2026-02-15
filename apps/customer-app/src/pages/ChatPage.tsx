'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Image as ImageIcon,
  MoreVertical,
  Phone,
  Check,
  CheckCheck,
  Clock,
  X,
  Camera,
  FileText,
  Smile,
} from 'lucide-react';

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  status?: MessageStatus;
  type: 'text' | 'image' | 'file';
  attachmentUrl?: string;
  attachmentName?: string;
}

interface Conversation {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  online: boolean;
  lastSeen?: string;
}

const CONVERSATION: Conversation = {
  id: '1',
  name: 'Property Management',
  role: 'Sunset Apartments',
  online: true,
};

const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    content: 'Hello! Welcome to Sunset Apartments. How can we help you today?',
    timestamp: '2024-02-20T09:00:00',
    isOwn: false,
    type: 'text',
  },
  {
    id: '2',
    content: 'Hi! I wanted to ask about the parking situation. Is there any guest parking available?',
    timestamp: '2024-02-20T09:05:00',
    isOwn: true,
    status: 'read',
    type: 'text',
  },
  {
    id: '3',
    content: 'Yes, we have designated guest parking spots in the visitor area near the main entrance. Guests can park there for up to 24 hours.',
    timestamp: '2024-02-20T09:07:00',
    isOwn: false,
    type: 'text',
  },
  {
    id: '4',
    content: 'For longer stays, please register the vehicle at the front desk.',
    timestamp: '2024-02-20T09:07:30',
    isOwn: false,
    type: 'text',
  },
  {
    id: '5',
    content: 'Perfect, thank you! One more question - what are the gym hours?',
    timestamp: '2024-02-20T09:10:00',
    isOwn: true,
    status: 'read',
    type: 'text',
  },
  {
    id: '6',
    content: 'The gym is open from 5:00 AM to 11:00 PM daily. You can access it with your key fob.',
    timestamp: '2024-02-20T09:12:00',
    isOwn: false,
    type: 'text',
  },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `msg_${Date.now()}`,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      isOwn: true,
      status: 'sending',
      type: 'text',
    };

    setMessages([...messages, message]);
    setNewMessage('');

    // Simulate message delivery
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'sent' as MessageStatus } : m))
      );
    }, 500);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: 'delivered' as MessageStatus } : m))
      );
    }, 1000);

    // Simulate typing indicator and response
    setTimeout(() => {
      setIsTyping(true);
    }, 1500);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev.map((m) => (m.id === message.id ? { ...m, status: 'read' as MessageStatus } : m)),
        {
          id: `msg_${Date.now()}`,
          content: 'Thank you for your message. We\'ll get back to you shortly!',
          timestamp: new Date().toISOString(),
          isOwn: false,
          type: 'text',
        },
      ]);
    }, 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const isImage = file.type.startsWith('image/');
      
      const message: Message = {
        id: `msg_${Date.now()}`,
        content: isImage ? '' : file.name,
        timestamp: new Date().toISOString(),
        isOwn: true,
        status: 'sending',
        type: isImage ? 'image' : 'file',
        attachmentUrl: url,
        attachmentName: file.name,
      };

      setMessages([...messages, message]);
      setShowAttachmentMenu(false);

      // Simulate upload
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, status: 'sent' as MessageStatus } : m))
        );
      }, 1000);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    msgs.forEach((msg) => {
      const msgDate = formatDate(msg.timestamp);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  const MessageStatusIcon = ({ status }: { status?: MessageStatus }) => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-primary-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-600 font-semibold">PM</span>
              </div>
              {CONVERSATION.online && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-success-500 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">{CONVERSATION.name}</h1>
              <p className="text-xs text-gray-500">
                {CONVERSATION.online ? 'Online' : `Last seen ${CONVERSATION.lastSeen}`}
              </p>
            </div>
          </div>

          <button className="p-2 rounded-full hover:bg-gray-100">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messageGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            {/* Date Separator */}
            <div className="flex justify-center my-4">
              <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
                {group.date}
              </span>
            </div>

            {/* Messages */}
            {group.messages.map((message, msgIdx) => (
              <div
                key={message.id}
                className={`flex mb-2 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.isOwn
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                  }`}
                >
                  {message.type === 'image' && message.attachmentUrl && (
                    <img
                      src={message.attachmentUrl}
                      alt="Attachment"
                      className="rounded-lg max-w-full mb-2"
                    />
                  )}
                  {message.type === 'file' && (
                    <div className={`flex items-center gap-2 mb-1 ${
                      message.isOwn ? 'text-white/90' : 'text-gray-600'
                    }`}>
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">{message.attachmentName}</span>
                    </div>
                  )}
                  {message.content && (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <div
                    className={`flex items-center justify-end gap-1 mt-1 ${
                      message.isOwn ? 'text-white/70' : 'text-gray-400'
                    }`}
                  >
                    <span className="text-xs">{formatTime(message.timestamp)}</span>
                    {message.isOwn && <MessageStatusIcon status={message.status} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start mb-2">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-3 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Paperclip className="w-5 h-5 text-gray-500" />
            </button>

            {/* Attachment Menu */}
            {showAttachmentMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowAttachmentMenu(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[160px]">
                  <button
                    onClick={() => {
                      fileInputRef.current?.setAttribute('accept', 'image/*');
                      fileInputRef.current?.setAttribute('capture', 'environment');
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50"
                  >
                    <Camera className="w-5 h-5 text-primary-500" />
                    Take Photo
                  </button>
                  <button
                    onClick={() => {
                      fileInputRef.current?.setAttribute('accept', 'image/*');
                      fileInputRef.current?.removeAttribute('capture');
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50"
                  >
                    <ImageIcon className="w-5 h-5 text-success-500" />
                    Photo Library
                  </button>
                  <button
                    onClick={() => {
                      fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx');
                      fileInputRef.current?.removeAttribute('capture');
                      fileInputRef.current?.click();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-50"
                  >
                    <FileText className="w-5 h-5 text-warning-500" />
                    Document
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-32"
              style={{ minHeight: '48px' }}
            />
            <button
              className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-gray-600"
            >
              <Smile className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={`p-3 rounded-full transition-colors ${
              newMessage.trim()
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
