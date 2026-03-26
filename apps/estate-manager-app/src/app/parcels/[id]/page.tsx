'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Layers, ExternalLink, User, FileText, Grid3X3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { parcelsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ParcelDetailPage() {
  const params = useParams();
  const parcelId = params.id as string;

  const { data: parcel, isLoading } = useQuery({
    queryKey: ['parcel', parcelId],
    queryFn: () => parcelsService.get(parcelId).then(r => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Parcel Detail" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  // Placeholder display for when API is wired
  const p = parcel as Record<string, unknown> | null;

  return (
    <>
      <PageHeader title={p?.name as string ?? 'Land Parcel'} showBack />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Map Placeholder */}
        <div className="card overflow-hidden">
          <div className="bg-gray-100 h-48 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <MapPin className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Map view will display here</p>
              {p?.mapUrl && (
                <a href={p.mapUrl as string} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm flex items-center justify-center gap-1 mt-2">
                  <ExternalLink className="w-3 h-3" /> Open in Google Maps
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Parcel Info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Parcel Details
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Code</div>
              <div className="font-medium">{(p?.parcelCode as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Type</div>
              <div className="font-medium">{(p?.type as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Total Area</div>
              <div className="font-medium">{Number(p?.totalAreaSqm ?? 0).toLocaleString()} sqm</div>
            </div>
            <div>
              <div className="text-gray-500">Available Area</div>
              <div className="font-medium">{Number(p?.availableAreaSqm ?? 0).toLocaleString()} sqm</div>
            </div>
            <div>
              <div className="text-gray-500">Region</div>
              <div className="font-medium">{(p?.region as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Status</div>
              <div className="font-medium">{(p?.status as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Railway Reserve</div>
              <div className="font-medium">{p?.nearRailwayReserve ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-gray-500">Title Deed</div>
              <div className="font-medium">{(p?.titleDeedNumber as string) ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Portions/Subdivisions */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Grid3X3 className="w-4 h-4" /> Portions / Subdivisions
            </h3>
            <Link href={`/parcels/${parcelId}/subdivide`} className="text-sm text-primary-600 font-medium">
              + Subdivide
            </Link>
          </div>
          <div className="text-center py-6 text-gray-400 text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2" />
            No portions created yet
          </div>
        </div>

        {/* Current Occupant */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Lease History
          </h3>
          <div className="text-center py-6 text-gray-400 text-sm">
            No lease history available
          </div>
        </div>
      </div>
    </>
  );
}
