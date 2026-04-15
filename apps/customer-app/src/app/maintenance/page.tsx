'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Clock, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { maintenanceService, type MaintenanceTicket } from '@bossnyumba/api-client';
import { LiveDataRequiredPanel } from '@/components/LiveDataRequired';
import '@/lib/api';

type TicketStatus =
  | 'submitted'
  | 'triaged'
  | 'pending_approval'
  | 'approved'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'pending_verification'
  | 'completed'
  | 'cancelled';

const OPEN_STATUSES: TicketStatus[] = [
  'submitted',
  'triaged',
  'pending_approval',
  'approved',
  'assigned',
  'scheduled',
  'in_progress',
  'pending_verification',
];

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'badge-info' },
  triaged: { label: 'Triaged', icon: Clock, color: 'badge-info' },
  pending_approval: { label: 'Pending Approval', icon: Clock, color: 'badge-info' },
  approved: { label: 'Approved', icon: Clock, color: 'badge-info' },
  assigned: { label: 'Assigned', icon: Wrench, color: 'badge-info' },
  scheduled: { label: 'Scheduled', icon: Clock, color: 'badge-info' },
  in_progress: { label: 'In Progress', icon: Wrench, color: 'badge-warning' },
  pending_verification: { label: 'Awaiting Verification', icon: Clock, color: 'badge-warning' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'badge-success' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, color: 'badge-neutral' },
};

const priorityColors: Record<string, string> = {
  emergency: 'border-l-danger-500',
  high: 'border-l-warning-500',
  medium: 'border-l-primary-500',
  low: 'border-l-gray-400',
};

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tenantId =
          typeof window !== 'undefined'
            ? localStorage.getItem('customer_tenant_id') ?? undefined
            : undefined;
        const res = await maintenanceService.list({ tenantId });
        if (cancelled) return;
        setTickets(res.data ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load tickets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openTickets = (tickets ?? []).filter((t) =>
    OPEN_STATUSES.includes(String(t.status).toLowerCase() as TicketStatus)
  );
  const closedTickets = (tickets ?? []).filter(
    (t) => !OPEN_STATUSES.includes(String(t.status).toLowerCase() as TicketStatus)
  );

  return (
    <>
      <PageHeader
        title="Maintenance"
        action={
          <Link href="/maintenance/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            New Request
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6">
        {loading && <div className="card p-6 text-center text-gray-500">Loading tickets…</div>}

        {!loading && error && (
          <LiveDataRequiredPanel title="Couldn't load maintenance tickets" message={error} />
        )}

        {!loading && !error && (
          <>
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">
                Open Requests ({openTickets.length})
              </h2>
              <div className="space-y-3">
                {openTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
                {openTickets.length === 0 && (
                  <div className="card p-6 text-center text-gray-500">
                    <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No open maintenance requests</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-3">
                Completed ({closedTickets.length})
              </h2>
              <div className="space-y-3">
                {closedTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function TicketCard({ ticket }: { ticket: MaintenanceTicket }) {
  const statusKey = String(ticket.status).toLowerCase();
  const status = statusConfig[statusKey] ?? statusConfig.submitted;
  const StatusIcon = status.icon;
  const priorityKey = String(ticket.priority).toLowerCase();

  return (
    <Link href={`/maintenance/${ticket.id}`}>
      <div className={`card p-4 border-l-4 ${priorityColors[priorityKey] ?? priorityColors.medium}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400 mb-1">
              {ticket.workOrderNumber ?? ticket.ticketNumber}
            </div>
            <div className="font-medium">{ticket.title}</div>
          </div>
          <span className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1 inline" />
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{String(ticket.category).replace(/_/g, ' ')}</span>
          {ticket.scheduledDate && (
            <span>Scheduled: {new Date(ticket.scheduledDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
