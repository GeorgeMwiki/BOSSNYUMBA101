'use client';

import { useQuery } from '@tanstack/react-query';
import { unitsService, propertiesService } from '@bossnyumba/api-client';

export default function OccupancyPage() {
  const { data: unitsData, isLoading: loadingUnits, error: unitsError } = useQuery({
    queryKey: ['units'],
    queryFn: () => unitsService.list({}),
  });

  const { data: propertiesData, isLoading: loadingProperties } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesService.list({}),
  });

  const units = unitsData?.data ?? [];
  const properties = propertiesData?.data ?? [];
  const isLoading = loadingUnits || loadingProperties;

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u: any) => u.status === 'occupied').length;
  const vacantUnits = units.filter((u: any) => u.status === 'vacant').length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (unitsError) {
    return (
      <div className="p-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load occupancy data: {(unitsError as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Occupancy</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-primary-600">{occupancyRate}%</p>
          <p className="text-sm text-gray-500 mt-1">Occupancy Rate</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold">{totalUnits}</p>
          <p className="text-sm text-gray-500 mt-1">Total Units</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{occupiedUnits}</p>
          <p className="text-sm text-gray-500 mt-1">Occupied</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-yellow-600">{vacantUnits}</p>
          <p className="text-sm text-gray-500 mt-1">Vacant</p>
        </div>
      </div>

      {/* Per-Property Breakdown */}
      {properties.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">By Property</h2>
          {properties.map((property: any) => {
            const propertyUnits = units.filter((u: any) => u.propertyId === property.id);
            const propOccupied = propertyUnits.filter((u: any) => u.status === 'occupied').length;
            const propTotal = propertyUnits.length;
            const propRate = propTotal > 0 ? Math.round((propOccupied / propTotal) * 100) : 0;

            return (
              <div key={property.id} className="card p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{property.name}</h3>
                  <span className="text-sm font-semibold text-primary-600">{propRate}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full transition-all"
                    style={{ width: `${propRate}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {propOccupied} of {propTotal} units occupied
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Units List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All Units</h2>
        {units.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">No units found</p>
            <p className="text-sm mt-1">Units will appear here once added to properties.</p>
          </div>
        )}
        {units.map((unit: any) => (
          <div key={unit.id} className="card p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{unit.name || unit.unitNumber}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {unit.propertyName || unit.property?.name || 'Property'}
                </p>
                {unit.tenantName && (
                  <p className="text-xs text-gray-400 mt-1">Tenant: {unit.tenantName}</p>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  unit.status === 'occupied'
                    ? 'bg-green-100 text-green-700'
                    : unit.status === 'maintenance'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {unit.status || 'vacant'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
