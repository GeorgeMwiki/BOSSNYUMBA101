import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Users, ArrowRight, Search } from 'lucide-react';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { formatPercentage } from '../lib/api';
import { useProperties } from '../lib/hooks';

export function PropertiesPage() {
  const { data: properties = [], isLoading, error, refetch } = useProperties();
  const [search, setSearch] = useState('');

  const filteredProperties = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.city.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load properties'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-gray-500">Manage your property portfolio</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProperties.map((property) => (
          <Link
            key={property.id}
            to={`/properties/${property.id}`}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="aspect-video bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Building2 className="h-16 w-16 text-white/50" />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{property.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin className="h-4 w-4" />
                    {property.address.city}, {property.address.region || property.address.country}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    property.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {property.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {property.occupiedUnits}/{property.totalUnits} units
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-blue-600">
                    {formatPercentage(
                      (property.occupiedUnits / property.totalUnits) * 100
                    )}{' '}
                    occupancy
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">{property.type}</span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredProperties.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title={search ? 'No matches' : 'No properties yet'}
          description={
            search
              ? 'Try adjusting your search to find what you\u2019re looking for.'
              : 'When you add properties they\u2019ll appear here.'
          }
        />
      )}
    </div>
  );
}
