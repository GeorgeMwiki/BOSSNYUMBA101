'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, AlertCircle, Wrench, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { maintenanceService, type MaintenanceTicket } from '@bossnyumba/api-client';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';
import '@/lib/api';

const statusConfig: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  submitted: { label: 'Submitted', icon: Clock, tone: 'text-primary-600' },
  triaged: { label: 'Triaged', icon: Clock, tone: 'text-primary-600' },
  pending_approval: { label: 'Pending Approval', icon: Clock, tone: 'text-primary-600' },
  approved: { label: 'Approved', icon: Clock, tone: 'text-primary-600' },
  assigned: { label: 'Assigned to Technician', icon: Wrench, tone: 'text-primary-600' },
  scheduled: { label: 'Scheduled', icon: Clock, tone: 'text-primary-600' },
  in_progress: { label: 'In Progress', icon: Wrench, tone: 'text-warning-600' },
  pending_verification: {
    label: 'Awaiting Your Confirmation',
    icon: CheckCircle,
    tone: 'text-warning-600',
  },
  completed: { label: 'Completed', icon: CheckCircle, tone: 'text-success-600' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, tone: 'text-gray-500' },
};

export default function MaintenanceDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const [ticket, setTicket] = useState<MaintenanceTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await maintenanceService.get(ticketId);
        if (cancelled) return;
        setTicket(res.data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load request');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (loading) {
    return (
      <>
        <PageHeader title="Maintenance Request" showBack />
        <div className="p-6 text-center text-gray-500">Loading…</div>
      </>
    );
  }

  if (error || !ticket) {
    return (
      <>
        <PageHeader title="Maintenance Request" showBack />
        <div className="px-4 py-4">
          <LiveDataRequiredPanel
            title="Couldn't load request"
            message={error ?? 'Request not found'}
          />
        </div>
      </>
    );
  }

  const statusKey = String(ticket.status).toLowerCase();
  const status = statusConfig[statusKey] ?? statusConfig.submitted;
  const StatusIcon = status.icon;
  const canRate = statusKey === 'completed' || statusKey === 'pending_verification';

  return (
    <>
      <PageHeader title="Maintenance Request" showBack />
      <div className="px-4 py-4 space-y-4">
        <section className="card p-4">
          <div className="text-xs text-gray-400 mb-1">
            {ticket.workOrderNumber ?? ticket.ticketNumber}
          </div>
          <h1 className="text-lg font-semibold mb-2">{ticket.title}</h1>
          <div className={`flex items-center gap-2 text-sm font-medium ${status.tone}`}>
            <StatusIcon className="w-4 h-4" />
            <span>{status.label}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
            <span className="capitalize">{String(ticket.category).replace(/_/g, ' ')}</span>
            <span className="capitalize">Priority: {String(ticket.priority).toLowerCase()}</span>
            {ticket.scheduledDate && (
              <span>Scheduled: {new Date(ticket.scheduledDate).toLocaleString()}</span>
            )}
          </div>
        </section>

        {ticket.description && (
          <section className="card p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Description</h2>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </section>
        )}

        {ticket.location && (
          <section className="card p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-1">Location</h2>
            <p className="text-sm">{ticket.location}</p>
          </section>
        )}

        {ticket.attachments && ticket.attachments.length > 0 && (
          <section className="card p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Photos</h2>
            <div className="grid grid-cols-3 gap-2">
              {ticket.attachments.map((att, idx) => (
                <div
                  key={`${att.url}-${idx}`}
                  className="aspect-square bg-gray-100 rounded overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.url} alt={att.filename} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {ticket.completionNotes && (
          <section className="card p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Technician notes</h2>
            <p className="text-sm whitespace-pre-wrap">{ticket.completionNotes}</p>
          </section>
        )}

        {canRate && (
          <Link
            href={`/maintenance/${ticket.id}/feedback`}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2"
          >
            <Star className="w-5 h-5" />
            Rate Service
          </Link>
        )}
      </div>
    </>
  );
}
