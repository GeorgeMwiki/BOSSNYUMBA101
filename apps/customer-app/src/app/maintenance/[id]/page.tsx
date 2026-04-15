'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
  Star,
  Wrench,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type MessageRecord, type WorkOrderRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; tone: string }
> = {
  submitted: { label: 'Submitted', icon: Clock, tone: 'bg-blue-500/20 text-blue-200' },
  triaged: { label: 'Triaged', icon: Clock, tone: 'bg-blue-500/20 text-blue-200' },
  assigned: { label: 'Assigned', icon: Wrench, tone: 'bg-indigo-500/20 text-indigo-200' },
  scheduled: { label: 'Scheduled', icon: Calendar, tone: 'bg-indigo-500/20 text-indigo-200' },
  in_progress: { label: 'In Progress', icon: Wrench, tone: 'bg-amber-500/20 text-amber-200' },
  completed: { label: 'Completed', icon: CheckCircle, tone: 'bg-emerald-500/20 text-emerald-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, tone: 'bg-red-500/20 text-red-200' },
};

function statusInfo(status: string) {
  const key = status.toLowerCase();
  return (
    STATUS_CONFIG[key] ?? {
      label: status,
      icon: Clock,
      tone: 'bg-gray-500/20 text-gray-200',
    }
  );
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const id = params?.id as string;

  const detailQuery = useQuery<WorkOrderRecord>({
    queryKey: ['work-orders', id],
    queryFn: () => api.workOrders.get(id),
    enabled: !!id,
    refetchInterval: 30000,
  });

  const messagesQuery = useQuery<MessageRecord[]>({
    queryKey: ['work-orders', id, 'messages'],
    queryFn: () => api.workOrders.listMessages(id),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const [message, setMessage] = useState('');
  const sendMessage = useMutation({
    mutationFn: (content: string) => api.workOrders.sendMessage(id, content),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['work-orders', id, 'messages'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to send', 'Message failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => api.workOrders.cancel(id, reason),
    onSuccess: () => {
      toast.success('Request cancelled');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders', id] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Failed to cancel request',
        'Cancellation failed'
      ),
  });

  if (detailQuery.isLoading) {
    return (
      <>
        <PageHeader title="Maintenance Request" showBack />
        <div className="flex items-center justify-center px-4 py-16 text-gray-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading request...
        </div>
      </>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <>
        <PageHeader title="Maintenance Request" showBack />
        <div className="space-y-3 px-4 py-4">
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Could not load request</p>
                <p className="text-sm">
                  {(detailQuery.error as Error | undefined)?.message ??
                    'Request not found.'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => detailQuery.refetch()}
            className="btn-primary w-full"
          >
            Try again
          </button>
        </div>
      </>
    );
  }

  const wo = detailQuery.data;
  const status = statusInfo(wo.status);
  const StatusIcon = status.icon;
  const canCancel = !['completed', 'cancelled'].includes(wo.status.toLowerCase());
  const canRate = wo.status.toLowerCase() === 'completed';
  const messages = messagesQuery.data ?? [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
  };

  const handleCancel = () => {
    const reason = window.prompt('Please tell us why you want to cancel this request');
    if (!reason?.trim()) return;
    cancelMutation.mutate(reason.trim());
  };

  return (
    <>
      <PageHeader title="Maintenance Request" showBack />
      <div className="space-y-4 px-4 py-4 pb-32">
        <section className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-400">
                {wo.workOrderNumber ?? `#${wo.id.slice(0, 8)}`}
              </div>
              <h2 className="mt-1 text-lg font-semibold text-white">{wo.title}</h2>
              <div className="mt-1 text-sm text-gray-400">
                {wo.category} · {wo.priority}
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.tone}`}
            >
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
          </div>
          {wo.description && (
            <p className="mt-3 text-sm text-gray-300">{wo.description}</p>
          )}
          {wo.location && (
            <div className="mt-3 text-xs text-gray-400">Location: {wo.location}</div>
          )}
          {wo.scheduledDate && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-500/10 p-3 text-sm text-indigo-200">
              <Calendar className="h-4 w-4" />
              Scheduled for {new Date(wo.scheduledDate).toLocaleString()}
              {wo.scheduledTimeSlot ? ` · ${wo.scheduledTimeSlot}` : ''}
            </div>
          )}
          {wo.slaStatus === 'at_risk' && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertCircle className="h-4 w-4" /> Response time at risk
            </div>
          )}
          {wo.slaStatus === 'breached' && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4" /> SLA breached
            </div>
          )}
        </section>

        {wo.attachments && wo.attachments.length > 0 && (
          <section className="card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
              <ImageIcon className="h-4 w-4" /> Attachments
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {wo.attachments.map((att) => (
                <a
                  key={att.url}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.url}
                    alt={att.filename}
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="card p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
            <MessageCircle className="h-4 w-4" /> Conversation
          </h3>
          <div className="mb-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {messagesQuery.isLoading && (
              <div className="text-sm text-gray-400">Loading messages...</div>
            )}
            {!messagesQuery.isLoading && messages.length === 0 && (
              <div className="text-sm text-gray-400">
                No messages yet. Start the conversation with the maintenance team.
              </div>
            )}
            {messages.map((m) => {
              const self = m.senderType === 'customer';
              return (
                <div
                  key={m.id}
                  className={`flex ${self ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      self
                        ? 'bg-primary-500/20 text-primary-100'
                        : 'bg-white/5 text-gray-100'
                    }`}
                  >
                    <p>{m.content}</p>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                      {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="input flex-1"
              disabled={sendMessage.isPending}
            />
            <button
              type="submit"
              className="btn-primary flex items-center justify-center rounded-lg px-4"
              disabled={!message.trim() || sendMessage.isPending}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        <div className="flex flex-col gap-3">
          {canRate && (
            <Link
              href={`/maintenance/${wo.id}/feedback`}
              className="btn-primary flex items-center justify-center gap-2 py-3"
            >
              <Star className="h-4 w-4" /> Rate this service
            </Link>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="btn-secondary w-full py-3"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel request'}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/requests')}
            className="text-sm text-gray-400 underline"
          >
            Back to all requests
          </button>
        </div>
      </div>
    </>
  );
}
