'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inspectionsService } from '@bossnyumba/api-client';

export default function InspectionsPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inspections', statusFilter],
    queryFn: () => inspectionsService.list({ status: statusFilter || undefined }),
  });

  const inspections = data?.data ?? [];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Inspections</h1>

      <div className="flex gap-2">
        {['', 'scheduled', 'in_progress', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`btn text-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
          >
            {status ? status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All'}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load inspections: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && inspections.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No inspections found</p>
          <p className="text-sm mt-1">Inspections will appear here once scheduled.</p>
        </div>
      )}

      <div className="space-y-3">
        {inspections.map((inspection: any) => (
          <a
            key={inspection.id}
            href={`/inspections/${inspection.id}`}
            className="card p-4 block hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{inspection.title || inspection.type || 'Inspection'}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {inspection.propertyName || inspection.property?.name || 'Property'}
                  {inspection.unitName || inspection.unit?.name ? ` - ${inspection.unitName || inspection.unit?.name}` : ''}
                </p>
                {inspection.scheduledDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(inspection.scheduledDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  inspection.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : inspection.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {inspection.status?.replace('_', ' ') || 'scheduled'}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
