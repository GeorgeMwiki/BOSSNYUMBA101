'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { inspectionsService } from '@bossnyumba/api-client';
import { Empty } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';

const TENANT_LOCALE =
  process.env.NEXT_PUBLIC_TENANT_LOCALE?.trim() || 'en';

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(TENANT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function InspectionsPage() {
  const inspectionsQuery = useQuery({
    queryKey: ['inspections-list-live'],
    queryFn: () => inspectionsService.list(undefined, 1, 50),
    retry: false,
  });

  const inspections = Array.isArray(inspectionsQuery.data?.data)
    ? inspectionsQuery.data!.data!
    : [];

  return (
    <>
      <PageHeader
        title="Inspections"
        subtitle={
          inspectionsQuery.isLoading ? 'Loading…' : `${inspections.length} inspections`
        }
      />

      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {inspectionsQuery.isLoading && (
          <div className="card p-4 text-sm text-gray-500">Loading inspections…</div>
        )}

        {inspectionsQuery.error && (
          <div className="card p-4 text-sm text-danger-600">
            {(inspectionsQuery.error as Error).message || 'Failed to load inspections.'}
          </div>
        )}

        {!inspectionsQuery.isLoading &&
          !inspectionsQuery.error &&
          inspections.length === 0 && (
            <Empty
              variant="default"
              icon={<ClipboardCheck className="h-8 w-8 text-gray-400" />}
              title="No inspections yet"
              description="Scheduled move-in, move-out, and condition inspections will show up here."
            />
          )}

        {inspections.map((inspection: Record<string, unknown>) => {
          const id = inspection.id as string;
          const type = (inspection.type as string) ?? 'Inspection';
          const status = (inspection.status as string) ?? 'scheduled';
          const scheduledDate = inspection.scheduledDate as string | undefined;
          const propertyName =
            (inspection as { property?: { name?: string } }).property?.name ?? '';
          const unitNumber =
            (inspection as { unit?: { unitNumber?: string } }).unit?.unitNumber ?? '';

          return (
            <Link
              key={id}
              href={`/inspections/${id}`}
              className="card block p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium capitalize">
                    {String(type).replace(/_/g, ' ').toLowerCase()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {[propertyName, unitNumber].filter(Boolean).join(' • ')}
                    {scheduledDate ? ` • ${formatDate(scheduledDate)}` : ''}
                  </div>
                </div>
                <div className="badge-info text-xs capitalize">
                  {String(status).replace(/_/g, ' ').toLowerCase()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
