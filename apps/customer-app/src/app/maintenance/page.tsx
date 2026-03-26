'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Clock, CheckCircle, AlertCircle, Wrench, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { workOrdersService } from '@bossnyumba/api-client';

type TicketStatus = 'submitted' | 'in_progress' | 'scheduled' | 'completed';

interface MaintenanceTicket {
  id: string;
  workOrderNumber: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: 'emergency' | 'high' | 'medium' | 'low';
  createdAt: string;
  scheduledDate?: string;
  slaStatus: 'on_track' | 'at_risk' | 'breached';
}

const statusConfig: Record<TicketStatus, { label: string; icon: React.ElementType; color: string }> = {
  submitted: { label: 'Submitted', icon: Clock, color: 'badge-info' },
  in_progress: { label: 'In Progress', icon: Wrench, color: 'badge-warning' },
  scheduled: { label: 'Scheduled', icon: Clock, color: 'badge-info' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'badge-success' },
};

const priorityColors = {
  emergency: 'border-l-danger-500',
  high: 'border-l-warning-500',
  medium: 'border-l-primary-500',
  low: 'border-l-gray-400',
};

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTickets() {
      try {
        const response = await workOrdersService.getMyRequests();
        const items = (response.data as unknown as Record<string, unknown>[]) ?? [];
        setTickets(
          items.map((wo: Record<string, unknown>) => ({
            id: (wo.id as string) ?? '',
            workOrderNumber: (wo.workOrderNumber as string) ?? wo.id as string,
            title: (wo.title as string) ?? '',
            category: (wo.category as string) ?? '',
            status: (wo.status as TicketStatus) ?? 'submitted',
            priority: (wo.priority as MaintenanceTicket['priority']) ?? 'medium',
            createdAt: (wo.createdAt as string) ?? '',
            scheduledDate: wo.scheduledDate as string | undefined,
            slaStatus: (wo.slaStatus as MaintenanceTicket['slaStatus']) ?? 'on_track',
          }))
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load maintenance requests');
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  const openTickets = tickets.filter((t) => t.status !== 'completed');
  const closedTickets = tickets.filter((t) => t.status === 'completed');

  if (loading) {
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  if (loadError) {
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
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600">{loadError}</p>
        </div>
      </>
    );
  }

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
        {/* Open Tickets */}
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

        {/* Closed Tickets */}
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
      </div>
    </>
  );
}

function TicketCard({ ticket }: { ticket: MaintenanceTicket }) {
  const status = statusConfig[ticket.status];
  const StatusIcon = status.icon;

  return (
    <Link href={`/maintenance/${ticket.id}`}>
      <div className={`card p-4 border-l-4 ${priorityColors[ticket.priority]}`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs text-gray-400 mb-1">{ticket.workOrderNumber}</div>
            <div className="font-medium">{ticket.title}</div>
          </div>
          <span className={status.color}>
            <StatusIcon className="w-3 h-3 mr-1 inline" />
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{ticket.category}</span>
          {ticket.scheduledDate && (
            <span>Scheduled: {new Date(ticket.scheduledDate).toLocaleDateString()}</span>
          )}
        </div>
        {ticket.slaStatus === 'at_risk' && (
          <div className="mt-2 flex items-center text-xs text-warning-600">
            <AlertCircle className="w-3 h-3 mr-1" />
            Response time at risk
          </div>
        )}
      </div>
    </Link>
  );
}
