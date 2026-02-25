'use client';

import Link from 'next/link';
import { Plus, Clock, CheckCircle, AlertCircle, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useI18n } from '@bossnyumba/i18n';

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

const priorityColors = {
  emergency: 'border-l-danger-500',
  high: 'border-l-warning-500',
  medium: 'border-l-primary-500',
  low: 'border-l-gray-400',
};

export default function MaintenancePage() {
  const { t } = useI18n();

  const statusConfig: Record<TicketStatus, { label: string; icon: React.ElementType; color: string }> = {
    submitted: { label: t('customer.maintenance.statusLabels.submitted'), icon: Clock, color: 'badge-info' },
    in_progress: { label: t('customer.maintenance.statusLabels.inProgress'), icon: Wrench, color: 'badge-warning' },
    scheduled: { label: t('common.status.scheduled'), icon: Clock, color: 'badge-info' },
    completed: { label: t('customer.maintenance.statusLabels.completed'), icon: CheckCircle, color: 'badge-success' },
  };

  const openTickets = tickets.filter((tk) => tk.status !== 'completed');
  const closedTickets = tickets.filter((tk) => tk.status === 'completed');

  return (
    <>
      <PageHeader
        title={t('customer.maintenance.title')}
        action={
          <Link href="/maintenance/new" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            {t('customer.maintenance.newRequest')}
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6">
        {/* Open Tickets */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            {t('customer.home.activeRequests')} ({openTickets.length})
          </h2>
          <div className="space-y-3">
            {openTickets.map((ticket) => {
              const status = statusConfig[ticket.status];
              const StatusIcon = status.icon;
              return (
                <Link key={ticket.id} href={`/maintenance/${ticket.id}`}>
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
                        <span>{t('common.status.scheduled')}: {new Date(ticket.scheduledDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {ticket.slaStatus === 'at_risk' && (
                      <div className="mt-2 flex items-center text-xs text-warning-600">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {t('estateManager.sla.responseTime')}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
            {openTickets.length === 0 && (
              <div className="card p-6 text-center text-gray-500">
                <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>{t('common.empty.noResults')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Closed Tickets */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            {t('common.status.completed')} ({closedTickets.length})
          </h2>
          <div className="space-y-3">
            {closedTickets.map((ticket) => {
              const status = statusConfig[ticket.status];
              const StatusIcon = status.icon;
              return (
                <Link key={ticket.id} href={`/maintenance/${ticket.id}`}>
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
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
