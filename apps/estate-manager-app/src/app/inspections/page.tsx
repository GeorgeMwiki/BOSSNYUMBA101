'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  Search,
  Calendar,
  ChevronRight,
  Plus,
  Loader2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Camera,
  Home,
  User,
  Filter,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { inspectionsService } from '@bossnyumba/api-client';

type InspectionType = 'move_in' | 'move_out' | 'routine' | 'pre_lease';
type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface Inspection {
  id: string;
  type: InspectionType;
  status: InspectionStatus;
  unit: {
    id: string;
    number: string;
    property: string;
  };
  customer?: {
    id: string;
    name: string;
    phone: string;
  };
  scheduledDate: string;
  completedDate?: string;
  inspector?: string;
  issues?: number;
  photos?: number;
}

const typeConfig: Record<InspectionType, { label: string; color: string }> = {
  move_in: { label: 'Move-In', color: 'badge-success' },
  move_out: { label: 'Move-Out', color: 'badge-warning' },
  routine: { label: 'Routine', color: 'badge-info' },
  pre_lease: { label: 'Pre-Lease', color: 'badge-primary' },
};

const statusConfig: Record<InspectionStatus, { label: string; badge: string; icon: React.ElementType }> = {
  scheduled: { label: 'Scheduled', badge: 'badge-info', icon: Calendar },
  in_progress: { label: 'In Progress', badge: 'badge-warning', icon: Clock },
  completed: { label: 'Completed', badge: 'badge-success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', badge: 'badge-gray', icon: AlertTriangle },
};

// Mock data
const MOCK_INSPECTIONS: Inspection[] = [
  {
    id: 'i1',
    type: 'move_in',
    status: 'scheduled',
    unit: { id: 'u1', number: 'A-101', property: 'Sunset Apartments' },
    customer: { id: 't1', name: 'John Kamau', phone: '+254 712 345 678' },
    scheduledDate: '2024-02-15T10:00:00',
    inspector: 'Mary Wanjiku',
  },
  {
    id: 'i2',
    type: 'move_out',
    status: 'scheduled',
    unit: { id: 'u2', number: 'B-201', property: 'Sunset Apartments' },
    customer: { id: 't2', name: 'Grace Achieng', phone: '+254 723 456 789' },
    scheduledDate: '2024-02-15T14:00:00',
    inspector: 'Mary Wanjiku',
  },
  {
    id: 'i3',
    type: 'routine',
    status: 'in_progress',
    unit: { id: 'u3', number: 'C-301', property: 'Sunset Apartments' },
    customer: { id: 't3', name: 'Peter Ochieng', phone: '+254 734 567 890' },
    scheduledDate: '2024-02-14T09:00:00',
    inspector: 'Mary Wanjiku',
    photos: 12,
    issues: 2,
  },
  {
    id: 'i4',
    type: 'pre_lease',
    status: 'completed',
    unit: { id: 'u4', number: 'A-102', property: 'Sunset Apartments' },
    scheduledDate: '2024-02-13T11:00:00',
    completedDate: '2024-02-13T12:30:00',
    inspector: 'Mary Wanjiku',
    photos: 45,
    issues: 0,
  },
  {
    id: 'i5',
    type: 'move_out',
    status: 'completed',
    unit: { id: 'u5', number: 'D-401', property: 'Sunset Apartments' },
    customer: { id: 't4', name: 'Sarah Njeri', phone: '+254 745 678 901' },
    scheduledDate: '2024-02-12T10:00:00',
    completedDate: '2024-02-12T11:45:00',
    inspector: 'Mary Wanjiku',
    photos: 68,
    issues: 5,
  },
];

export default function InspectionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<InspectionType | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('all');

  const { data: inspectionsData, isLoading } = useQuery({
    queryKey: ['inspections'],
    queryFn: () => inspectionsService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  const inspections: Inspection[] = useMemo(() => {
    if (!inspectionsData?.data?.length) return MOCK_INSPECTIONS;
    return inspectionsData.data as Inspection[];
  }, [inspectionsData]);

  const filteredInspections = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return inspections.filter((inspection) => {
      const statusMatch = statusFilter === 'all' || inspection.status === statusFilter;
      const typeMatch = typeFilter === 'all' || inspection.type === typeFilter;
      const searchMatch =
        !searchQuery ||
        inspection.unit.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inspection.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const inspDate = new Date(inspection.scheduledDate);
      let dateMatch = true;
      if (dateFilter === 'today') {
        dateMatch = inspDate >= today && inspDate < new Date(today.getTime() + 86400000);
      } else if (dateFilter === 'week') {
        dateMatch = inspDate >= today && inspDate <= weekEnd;
      }

      return statusMatch && typeMatch && searchMatch && dateMatch;
    });
  }, [inspections, statusFilter, typeFilter, searchQuery, dateFilter]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Inspection[]> = {};
    filteredInspections.forEach((insp) => {
      const date = new Date(insp.scheduledDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(insp);
    });
    return groups;
  }, [filteredInspections]);

  const stats = useMemo(() => ({
    scheduled: inspections.filter((i) => i.status === 'scheduled').length,
    inProgress: inspections.filter((i) => i.status === 'in_progress').length,
    completedToday: inspections.filter((i) => {
      if (i.status !== 'completed' || !i.completedDate) return false;
      const today = new Date();
      const completed = new Date(i.completedDate);
      return completed.toDateString() === today.toDateString();
    }).length,
    issues: inspections.reduce((sum, i) => sum + (i.issues || 0), 0),
  }), [inspections]);

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={`${inspections.length} total inspections`}
        action={
          <Link href="/inspections/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Schedule
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto pb-24">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="card p-3 text-center">
                <div className="text-xl font-bold text-primary-600">{stats.scheduled}</div>
                <div className="text-xs text-gray-500">Scheduled</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-xl font-bold text-warning-600">{stats.inProgress}</div>
                <div className="text-xs text-gray-500">In Progress</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-xl font-bold text-success-600">{stats.completedToday}</div>
                <div className="text-xs text-gray-500">Done Today</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-xl font-bold text-danger-600">{stats.issues}</div>
                <div className="text-xs text-gray-500">Issues</div>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(['today', 'week', 'all'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    dateFilter === filter
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {filter === 'today' ? "Today's" : filter === 'week' ? 'This Week' : 'All'}
                </button>
              ))}
            </div>

            {/* Type & Status Filters */}
            <div className="flex gap-2">
              <select
                className="input text-sm flex-1"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as InspectionType | 'all')}
              >
                <option value="all">All Types</option>
                {Object.entries(typeConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <select
                className="input text-sm flex-1"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InspectionStatus | 'all')}
              >
                <option value="all">All Status</option>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search units, tenants..."
                className="input pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Inspections List Grouped by Date */}
            <div className="space-y-6">
              {Object.entries(groupedByDate).map(([date, dateInspections]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-gray-500 mb-3">{date}</h3>
                  <div className="space-y-3">
                    {dateInspections.map((inspection) => {
                      const typeConf = typeConfig[inspection.type];
                      const statusConf = statusConfig[inspection.status];
                      const StatusIcon = statusConf.icon;

                      return (
                        <Link
                          key={inspection.id}
                          href={
                            inspection.status === 'scheduled'
                              ? `/inspections/${inspection.id}/conduct`
                              : `/inspections/${inspection.id}`
                          }
                          className="card p-4 block"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={typeConf.color}>{typeConf.label}</span>
                              <span className={statusConf.badge}>
                                <StatusIcon className="w-3 h-3 mr-1 inline" />
                                {statusConf.label}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(inspection.scheduledDate).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Home className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-medium">{inspection.unit.number}</div>
                              <div className="text-sm text-gray-500">{inspection.unit.property}</div>
                            </div>
                          </div>

                          {inspection.customer && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                              <User className="w-4 h-4" />
                              <span>{inspection.customer.name}</span>
                            </div>
                          )}

                          {(inspection.photos !== undefined || inspection.issues !== undefined) && (
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              {inspection.photos !== undefined && (
                                <span className="flex items-center gap-1">
                                  <Camera className="w-4 h-4" />
                                  {inspection.photos} photos
                                </span>
                              )}
                              {inspection.issues !== undefined && inspection.issues > 0 && (
                                <span className="flex items-center gap-1 text-warning-600">
                                  <AlertTriangle className="w-4 h-4" />
                                  {inspection.issues} issues
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <span className="text-xs text-gray-400">
                              {inspection.inspector && `Assigned: ${inspection.inspector}`}
                            </span>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {Object.keys(groupedByDate).length === 0 && (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900">No inspections found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery ? 'Try a different search' : 'Schedule your first inspection'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
