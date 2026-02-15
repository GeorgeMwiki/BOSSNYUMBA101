import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Users,
  DollarSign,
  Home,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { api, formatCurrency, formatPercentage } from '../lib/api';

interface Property {
  id: string;
  name: string;
  type: string;
  status: string;
  address: {
    line1: string;
    city: string;
    region?: string;
    country: string;
  };
  description?: string;
  amenities: string[];
  totalUnits: number;
  occupiedUnits: number;
  stats?: {
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    occupancyRate: number;
  };
}

interface Unit {
  id: string;
  unitNumber: string;
  floor?: number;
  type: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  squareMeters?: number;
  rentAmount: number;
}

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get<Property>(`/properties/${id}`),
      api.get<Unit[]>(`/properties/${id}/units`),
    ]).then(([propertyRes, unitsRes]) => {
      if (propertyRes.success && propertyRes.data) {
        setProperty(propertyRes.data);
      }
      if (unitsRes.success && unitsRes.data) {
        setUnits(unitsRes.data);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12 text-gray-500">Property not found</div>
    );
  }

  const stats = property.stats || {
    totalUnits: property.totalUnits,
    occupiedUnits: property.occupiedUnits,
    availableUnits: property.totalUnits - property.occupiedUnits,
    occupancyRate: (property.occupiedUnits / property.totalUnits) * 100,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/properties"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
          <div className="flex items-center gap-1 text-gray-500">
            <MapPin className="h-4 w-4" />
            {property.address.line1}, {property.address.city}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Home className="h-4 w-4" />
            <span className="text-sm font-medium">Total Units</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {stats.totalUnits}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Occupied</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {stats.occupiedUnits}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-yellow-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">Available</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {stats.availableUnits}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Occupancy Rate</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {formatPercentage(stats.occupancyRate)}
          </p>
        </div>
      </div>

      {/* Property details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Units list */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Units</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {units.map((unit) => (
                <div
                  key={unit.id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Home className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Unit {unit.unitNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        {unit.bedrooms}BR / {unit.bathrooms}BA
                        {unit.squareMeters && ` / ${unit.squareMeters} m²`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {formatCurrency(unit.rentAmount)}/mo
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        unit.status === 'OCCUPIED'
                          ? 'text-green-600'
                          : unit.status === 'AVAILABLE'
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {unit.status === 'OCCUPIED' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : unit.status === 'AVAILABLE' ? (
                        <Clock className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {unit.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Property info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Property Info</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Type</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {property.type}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <span
                    className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                      property.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {property.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Address</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {property.address.line1}
                  <br />
                  {property.address.city}
                  {property.address.region && `, ${property.address.region}`}
                  <br />
                  {property.address.country}
                </dd>
              </div>
            </dl>
          </div>

          {/* Amenities */}
          {property.amenities.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-lg"
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
