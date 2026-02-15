'use client';

import Link from 'next/link';
import { Plus, Clock, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

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

const tickets: MaintenanceTicket[] = [
  {
    id: '1',
    workOrderNumber: 'WO-2024-0042',
    title: 'Kitchen sink leaking',
    category: 'Plumbing',
    status: 'scheduled',
    priority: 'high',
    createdAt: '2024-02-20',
    scheduledDate: '2024-02-25',
    slaStatus: 'on_track',
  },
  {
    id: '2',
    workOrderNumber: 'WO-2024-0038',
    title: 'AC not cooling properly',
    category: 'HVAC',
    status: 'in_progress',
    priority: 'medium',
    createdAt: '2024-02-18',
    slaStatus: 'at_risk',
  },
  {
    id: '3',
    workOrderNumber: 'WO-2024-0031',
    title: 'Broken door handle',
    category: 'General',
    status: 'completed',
    priority: 'low',
    createdAt: '2024-02-10',
    slaStatus: 'on_track',
  },
];

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
  const openTickets = tickets.filter((t) => t.status !== 'completed');
  const closedTickets = tickets.filter((t) => t.status === 'completed');

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
