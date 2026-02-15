'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, Wrench, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { RequestCard, type MaintenanceRequest, type RequestStatus } from '@/components/requests';

const mockRequests: MaintenanceRequest[] = [
  {
    id: '1',
    workOrderNumber: 'WO-2024-0042',
    title: 'Kitchen sink leaking',
    category: 'Plumbing',
    status: 'scheduled',
    priority: 'high',
    createdAt: '2024-02-20',
    scheduledDate: '2024-02-25',
  },
  {
    id: '2',
    workOrderNumber: 'WO-2024-0038',
    title: 'AC not cooling properly',
    category: 'HVAC',
    status: 'in_progress',
    priority: 'normal',
    createdAt: '2024-02-18',
  },
  {
    id: '3',
    workOrderNumber: 'WO-2024-0031',
    title: 'Broken door handle',
    category: 'Structural',
    status: 'completed',
    priority: 'low',
    createdAt: '2024-02-10',
  },
  {
    id: '4',
    workOrderNumber: 'WO-2024-0045',
    title: 'Outlet not working',
    category: 'Electrical',
    status: 'submitted',
    priority: 'high',
    createdAt: '2024-02-22',
  },
];

const statusFilters: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function RequestsPage() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [showFeedbackSuccess, setShowFeedbackSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('feedback') === 'submitted') {
      setShowFeedbackSuccess(true);
      const timer = setTimeout(() => setShowFeedbackSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const filteredRequests = mockRequests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const openRequests = filteredRequests.filter((r) => r.status !== 'completed').sort((a, b) => {
    const order = { submitted: 0, scheduled: 1, in_progress: 2 };
    return (order[a.status] ?? 999) - (order[b.status] ?? 999);
  });
  const completedRequests = filteredRequests.filter((r) => r.status === 'completed');

  return (
    <>
      <PageHeader title="Maintenance Requests" />

      <div className="px-4 py-4 pb-24">
        {showFeedbackSuccess && (
          <div className="mb-4 p-4 rounded-xl bg-success-50 border border-success-200 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-success-600 flex-shrink-0" />
            <p className="text-sm font-medium text-success-800">Thank you for your feedback!</p>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-4 -mx-1 scrollbar-hide">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                statusFilter === filter.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {openRequests.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Active ({openRequests.length})
            </h2>
            <div className="space-y-3">
              {openRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </section>
        )}

        {completedRequests.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-3">
              Completed ({completedRequests.length})
            </h2>
            <div className="space-y-3">
              {completedRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          </section>
        )}

        {filteredRequests.length === 0 && (
          <div className="card p-8 text-center">
            <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 mb-1">No maintenance requests</p>
            <p className="text-sm text-gray-400 mb-4">
              {statusFilter === 'all'
                ? 'Report an issue to get started'
                : `No ${statusFilter.replace('_', ' ')} requests`}
            </p>
            <Link href="/requests/new" className="btn-primary inline-flex">
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Link>
          </div>
        )}
      </div>

      <Link
        href="/requests/new"
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors z-30"
        aria-label="New maintenance request"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </>
  );
}
