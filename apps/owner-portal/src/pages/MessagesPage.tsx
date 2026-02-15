import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Paperclip,
  Image,
  File,
  X,
  Check,
  CheckCheck,
  Clock,
  Plus,
  Phone,
  MoreVertical,
  Smile,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api, formatDateTime } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────
type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

interface Attachment {
  id: string;
  type: 'image' | 'document' | 'file';
  name: string;
  url: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'owner' | 'manager' | 'system';
  senderName: string;
  content: string;
  status: MessageStatus;
  attachments: Attachment[];
  readAt?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  participantName: string;
  participantRole: string;
  participantInitials: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline?: boolean;
  propertyContext?: string;
}

// ─── Status Icon Component ───────────────────────────────────────
function MessageStatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'SENDING':
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    case 'SENT':
      return <Check className="h-3.5 w-3.5 text-gray-400" />;
    case 'DELIVERED':
      return <CheckCheck className="h-3.5 w-3.5 text-gray-400" />;
    case 'READ':
      return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
    case 'FAILED':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    default:
      return null;
  }
}

// ─── Attachment Preview Component ─────────────────────────────────
function AttachmentPreview({
  attachment,
  isOwn,
}: {
  attachment: Attachment;
  isOwn: boolean;
}) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (attachment.type === 'image') {
    return (
      <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
        <img
          src={attachment.thumbnailUrl || attachment.url}
          alt={attachment.name}
          className="w-full h-auto max-h-48 object-cover cursor-pointer hover:opacity-90"
        />
        <div
          className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
            isOwn ? 'bg-blue-700 text-blue-200' : 'bg-gray-200 text-gray-500'
          }`}
        >
          <Image className="h-3 w-3" />
          <span className="truncate">{attachment.name}</span>
          <span>{formatSize(attachment.size)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mt-2 flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
        isOwn
          ? 'border-blue-400 bg-blue-500/20'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div
        className={`p-2 rounded ${
          isOwn ? 'bg-blue-400/30' : 'bg-gray-200'
        }`}
      >
        <File
          className={`h-4 w-4 ${
            isOwn ? 'text-white' : 'text-gray-500'
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium truncate ${
            isOwn ? 'text-white' : 'text-gray-900'
          }`}
        >
          {attachment.name}
        </p>
        <p
          className={`text-xs ${
            isOwn ? 'text-blue-200' : 'text-gray-500'
          }`}
        >
          {formatSize(attachment.size)}
        </p>
      </div>
      <button
        className={`p-1 rounded hover:bg-black/10 ${
          isOwn ? 'text-white' : 'text-gray-400'
        }`}
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    loadConversations();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Poll for new messages every 5 seconds
    if (activeConversation) {
      pollingRef.current = setInterval(() => {
        loadMessages(activeConversation.id, true);
      }, 5000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    setLoading(true);
    try {
      const response = await api.get<Conversation[]>(
        '/owner/messaging/conversations'
      );
      if (response.success && response.data) {
        setConversations(response.data);
        if (response.data.length > 0) {
          selectConversation(response.data[0]);
        }
      }
    } catch {
      // Fallback mock data
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          participantName: 'Sarah Kimaro',
          participantRole: 'Property Manager - Palm Gardens',
          participantInitials: 'SK',
          lastMessage:
            'The maintenance request for Unit A101 has been completed.',
          lastMessageTime: '2026-02-13T08:30:00Z',
          unreadCount: 2,
          isOnline: true,
          propertyContext: 'Palm Gardens',
        },
        {
          id: 'conv-2',
          participantName: 'John Mwanga',
          participantRole: 'Estate Manager - Ocean View',
          participantInitials: 'JM',
          lastMessage: 'Monthly report is ready for your review.',
          lastMessageTime: '2026-02-12T14:15:00Z',
          unreadCount: 0,
          isOnline: false,
          propertyContext: 'Ocean View Apartments',
        },
        {
          id: 'conv-3',
          participantName: 'Amina Hassan',
          participantRole: 'Finance Manager',
          participantInitials: 'AH',
          lastMessage:
            'The February disbursement will be processed on the 28th.',
          lastMessageTime: '2026-02-11T10:00:00Z',
          unreadCount: 0,
          isOnline: true,
        },
      ];
      setConversations(mockConversations);
      selectConversation(mockConversations[0]);
    }
    setLoading(false);
  };

  const selectConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setShowMobileSidebar(false);

    // Mark as read
    if (conversation.unreadCount > 0) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversation.id ? { ...c, unreadCount: 0 } : c
        )
      );
    }

    await loadMessages(conversation.id);
  };

  const loadMessages = async (conversationId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const response = await api.get<Message[]>(
        `/owner/messaging/conversations/${conversationId}/messages`
      );
      if (response.success && response.data) {
        setMessages(response.data);
      }
    } catch {
      // Mock messages
      if (!silent) {
        const mockMessages: Message[] = [
          {
            id: 'm1',
            conversationId,
            senderId: 'manager-1',
            senderType: 'manager',
            senderName: 'Sarah Kimaro',
            content:
              'Good morning! The maintenance request for Unit A101 has been completed. The plumber replaced the faulty valve under the kitchen sink.',
            status: 'READ',
            attachments: [],
            readAt: '2026-02-13T08:35:00Z',
            createdAt: '2026-02-13T08:30:00Z',
          },
          {
            id: 'm2',
            conversationId,
            senderId: 'owner-1',
            senderType: 'owner',
            senderName: 'John Doe',
            content: 'Thank you for the update. What was the total cost?',
            status: 'READ',
            attachments: [],
            readAt: '2026-02-13T08:46:00Z',
            createdAt: '2026-02-13T08:45:00Z',
          },
          {
            id: 'm3',
            conversationId,
            senderId: 'manager-1',
            senderType: 'manager',
            senderName: 'Sarah Kimaro',
            content:
              "The total cost was TZS 45,000 including parts and labor. I've uploaded the receipt to the documents section.",
            status: 'READ',
            attachments: [
              {
                id: 'att-1',
                type: 'document',
                name: 'Plumbing_Receipt_A101.pdf',
                url: '#',
                size: 245000,
                mimeType: 'application/pdf',
              },
            ],
            readAt: '2026-02-13T08:55:00Z',
            createdAt: '2026-02-13T08:52:00Z',
          },
          {
            id: 'm4',
            conversationId,
            senderId: 'owner-1',
            senderType: 'owner',
            senderName: 'John Doe',
            content: 'Good, that seems reasonable. Please also check Unit B-301 water heater.',
            status: 'DELIVERED',
            attachments: [],
            createdAt: '2026-02-13T09:00:00Z',
          },
          {
            id: 'm5',
            conversationId,
            senderId: 'manager-1',
            senderType: 'manager',
            senderName: 'Sarah Kimaro',
            content:
              'Will do! I have inspected B-301 this morning. Here are the photos of the water heater. It looks like it needs a thermostat replacement. Estimated cost TZS 120,000.',
            status: 'READ',
            attachments: [
              {
                id: 'att-2',
                type: 'image',
                name: 'water_heater_1.jpg',
                url: 'https://via.placeholder.com/400x300?text=Water+Heater+Photo',
                thumbnailUrl:
                  'https://via.placeholder.com/400x300?text=Water+Heater+Photo',
                size: 1200000,
                mimeType: 'image/jpeg',
              },
              {
                id: 'att-3',
                type: 'image',
                name: 'water_heater_2.jpg',
                url: 'https://via.placeholder.com/400x300?text=Thermostat+Close-up',
                thumbnailUrl:
                  'https://via.placeholder.com/400x300?text=Thermostat+Close-up',
                size: 980000,
                mimeType: 'image/jpeg',
              },
            ],
            readAt: '2026-02-13T09:20:00Z',
            createdAt: '2026-02-13T09:15:00Z',
          },
          {
            id: 'm6',
            conversationId,
            senderId: 'manager-1',
            senderType: 'manager',
            senderName: 'Sarah Kimaro',
            content:
              'Should I go ahead and authorize the repair? The vendor can schedule it for tomorrow.',
            status: 'DELIVERED',
            attachments: [],
            createdAt: '2026-02-13T09:16:00Z',
          },
        ];
        setMessages(mockMessages);
      }
    }
    if (!silent) setMessagesLoading(false);
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !activeConversation)
      return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      conversationId: activeConversation.id,
      senderId: user?.id || 'owner-1',
      senderType: 'owner',
      senderName: `${user?.firstName || 'John'} ${user?.lastName || 'Doe'}`,
      content: newMessage.trim(),
      status: 'SENDING',
      attachments: pendingAttachments.map((file, i) => ({
        id: `pending-att-${i}`,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        mimeType: file.type,
      })),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    setPendingAttachments([]);
    setSending(true);

    try {
      await api.post(
        `/owner/messaging/conversations/${activeConversation.id}/messages`,
        { content: tempMessage.content }
      );
      // Update message status to SENT
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: 'SENT' as MessageStatus } : m
        )
      );

      // Simulate delivered after 1.5s
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: 'DELIVERED' as MessageStatus }
              : m
          )
        );
      }, 1500);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: 'SENT' as MessageStatus } : m
        )
      );
    }

    // Update conversation last message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              lastMessage: tempMessage.content || 'Sent an attachment',
              lastMessageTime: tempMessage.createdAt,
            }
          : c
      )
    );

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setPendingAttachments((prev) => [...prev, ...Array.from(files)]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateTime(dateStr);
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.participantName.toLowerCase().includes(search.toLowerCase()) ||
      c.propertyContext?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500">Communicate with your property managers</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 h-[calc(100vh-240px)] flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`w-full sm:w-80 border-r border-gray-200 flex flex-col ${
            !showMobileSidebar ? 'hidden sm:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => selectConversation(conversation)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    activeConversation?.id === conversation.id
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                        {conversation.participantInitials}
                      </div>
                      {conversation.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {conversation.participantName}
                        </p>
                        {conversation.lastMessageTime && (
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatRelativeTime(conversation.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      {conversation.propertyContext && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          {conversation.propertyContext}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-500 truncate">
                          {conversation.lastMessage}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="ml-2 flex-shrink-0 h-5 w-5 flex items-center justify-center bg-blue-600 text-white text-xs font-medium rounded-full">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div
          className={`flex-1 flex flex-col ${
            showMobileSidebar ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="sm:hidden p-1 text-gray-400 hover:text-gray-600"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                      {activeConversation.participantInitials}
                    </div>
                    {activeConversation.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {activeConversation.participantName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activeConversation.isOnline ? (
                        <span className="text-green-600">Online</span>
                      ) : (
                        activeConversation.participantRole
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Phone className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isOwn = message.senderType === 'owner';
                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isOwn ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[75%] ${
                              isOwn
                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                                : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md'
                            } p-3`}
                          >
                            {/* System messages */}
                            {message.senderType === 'system' && (
                              <p className="text-xs text-center text-gray-500 italic">
                                {message.content}
                              </p>
                            )}
                            {message.senderType !== 'system' && (
                              <>
                                {message.content && (
                                  <p className="text-sm whitespace-pre-wrap">
                                    {message.content}
                                  </p>
                                )}
                                {/* Attachments */}
                                {message.attachments.map((att) => (
                                  <AttachmentPreview
                                    key={att.id}
                                    attachment={att}
                                    isOwn={isOwn}
                                  />
                                ))}
                                {/* Timestamp and status */}
                                <div
                                  className={`flex items-center gap-1.5 mt-1.5 ${
                                    isOwn ? 'justify-end' : ''
                                  }`}
                                >
                                  <p
                                    className={`text-xs ${
                                      isOwn
                                        ? 'text-blue-200'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    {formatTime(message.createdAt)}
                                  </p>
                                  {isOwn && (
                                    <MessageStatusIcon
                                      status={message.status}
                                    />
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Pending Attachments Preview */}
              {pendingAttachments.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100 flex gap-2 overflow-x-auto">
                  {pendingAttachments.map((file, index) => (
                    <div
                      key={index}
                      className="relative flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg"
                    >
                      {file.type.startsWith('image/') ? (
                        <Image className="h-4 w-4 text-gray-500" />
                      ) : (
                        <File className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="text-sm text-gray-700 max-w-[120px] truncate">
                        {file.name}
                      </span>
                      <button
                        onClick={() => removePendingAttachment(index)}
                        className="p-0.5 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Message input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-end gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
                    title="Attach file"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto"
                      style={{
                        height: 'auto',
                        minHeight: '42px',
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height =
                          Math.min(target.scrollHeight, 128) + 'px';
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={
                      (!newMessage.trim() &&
                        pendingAttachments.length === 0) ||
                      sending
                    }
                    className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm text-gray-400 mt-1">
                  Choose from your existing conversations
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
