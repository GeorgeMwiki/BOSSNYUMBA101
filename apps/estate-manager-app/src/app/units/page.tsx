'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  Home,
  Search,
  Filter,
  ChevronRight,
  User,
  Phone,
  Calendar,
  DollarSign,
  Loader2,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  Wrench,
  UserPlus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { unitsService } from '@bossnyumba/api-client';

type UnitStatus = 'OCCUPIED' | 'VACANT' | 'TURNOVER' | 'MAINTENANCE' | 'RESERVED';

interface Unit {
  id: string;
  unitNumber: string;
  property: string;
  propertyId: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  status: UnitStatus;
  monthlyRent: number;
  currentTenant?: {
    id: string;
    name: string;
    phone: string;
    leaseEnd: string;
    balance: number;
  };
  lastInspection?: string;
  daysVacant?: number;
}

const statusConfig: Record<UnitStatus, { label: string; badge: string; icon: React.ElementType }> = {
  OCCUPIED: { label: 'Occupied', badge: 'badge-success', icon: CheckCircle },
  VACANT: { label: 'Vacant', badge: 'badge-warning', icon: Home },
  TURNOVER: { label: 'Turnover', badge: 'badge-info', icon: Clock },
  MAINTENANCE: { label: 'Maintenance', badge: 'badge-danger', icon: Wrench },
  RESERVED: { label: 'Reserved', badge: 'badge-primary', icon: Calendar },
};

// Mock data
const MOCK_UNITS: Unit[] = [
  {
    id: 'u1', unitNumber: 'A-101', property: 'Sunset Apartments', propertyId: 'p1',
    type: '2 Bedroom', bedrooms: 2, bathrooms: 1, sqft: 850, status: 'OCCUPIED',
    monthlyRent: 45000,
    currentTenant: { id: 't1', name: 'John Kamau', phone: '+254 712 345 678', leaseEnd: '2024-08-31', balance: 0 },
    lastInspection: '2024-01-15',
  },
  {
    id: 'u2', unitNumber: 'A-102', property: 'Sunset Apartments', propertyId: 'p1',
    type: '1 Bedroom', bedrooms: 1, bathrooms: 1, sqft: 550, status: 'VACANT',
    monthlyRent: 32000, daysVacant: 12,
  },
  {
    id: 'u3', unitNumber: 'A-103', property: 'Sunset Apartments', propertyId: 'p1',
    type: '2 Bedroom', bedrooms: 2, bathrooms: 2, sqft: 950, status: 'OCCUPIED',
    monthlyRent: 52000,
    currentTenant: { id: 't2', name: 'Mary Wanjiku', phone: '+254 723 456 789', leaseEnd: '2024-05-15', balance: 45000 },
  },
  {
    id: 'u4', unitNumber: 'B-201', property: 'Sunset Apartments', propertyId: 'p1',
    type: '3 Bedroom', bedrooms: 3, bathrooms: 2, sqft: 1200, status: 'TURNOVER',
    monthlyRent: 75000, daysVacant: 3,
  },
  {
    id: 'u5', unitNumber: 'B-202', property: 'Sunset Apartments', propertyId: 'p1',
    type: '2 Bedroom', bedrooms: 2, bathrooms: 1, sqft: 850, status: 'MAINTENANCE',
    monthlyRent: 45000,
  },
  {
    id: 'u6', unitNumber: 'C-301', property: 'Sunset Apartments', propertyId: 'p1',
    type: 'Studio', bedrooms: 0, bathrooms: 1, sqft: 400, status: 'RESERVED',
    monthlyRent: 25000,
  },
];

export default function UnitsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UnitStatus | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const { data: unitsData, isLoading } = useQuery({
    queryKey: ['units', { page: 1, pageSize: 100 }],
    queryFn: () => unitsService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  // Map API data or use fallback
  const units: Unit[] = useMemo(() => {
    if (!unitsData?.data?.length) return MOCK_UNITS;
    return unitsData.data.map((u: Record<string, unknown>) => ({
      id: u.id as string,
      unitNumber: (u.unitNumber as string) || 'Unknown',
      property: (u as { property?: { name?: string } })?.property?.name ?? 'Unknown',
      propertyId: (u.propertyId as string) || '',
      type: (u.unitType as string) || '2 Bedroom',
      bedrooms: (u.bedrooms as number) ?? 2,
      bathrooms: (u.bathrooms as number) ?? 1,
      sqft: (u.sqft as number) ?? 850,
      status: ((u.status as string) || 'VACANT') as UnitStatus,
      monthlyRent: (u.monthlyRent as number) ?? 45000,
    }));
  }, [unitsData]);

  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      const statusMatch = statusFilter === 'all' || unit.status === statusFilter;
      const searchMatch =
        !searchQuery ||
        unit.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.property.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unit.currentTenant?.name.toLowerCase().includes(searchQuery.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [units, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<UnitStatus | 'all', number> = {
      all: units.length,
      OCCUPIED: 0,
      VACANT: 0,
      TURNOVER: 0,
      MAINTENANCE: 0,
      RESERVED: 0,
    };
    units.forEach((u) => counts[u.status]++);
    return counts;
  }, [units]);

  const occupancyRate = units.length > 0
    ? Math.round((statusCounts.OCCUPIED / units.length) * 100)
    : 0;

  return (
    <>
      <PageHeader
        title="Units"
        subtitle={`${units.length} total units`}
        action={
          <Link href="/units/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add Unit
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
            {/* Occupancy Summary */}
            <div className="card p-4 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-primary-600">Occupancy Rate</div>
                  <div className="text-3xl font-bold text-primary-700">{occupancyRate}%</div>
                </div>
                <div className="text-right text-sm text-primary-600">
                  <div>{statusCounts.OCCUPIED} Occupied</div>
                  <div>{statusCounts.VACANT + statusCounts.TURNOVER} Available</div>
                </div>
              </div>
            </div>

            {/* Status Filters */}
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex gap-2 min-w-max pb-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All ({statusCounts.all})
                </button>
                {(Object.keys(statusConfig) as UnitStatus[]).map((status) => {
                  const config = statusConfig[status];
                  const Icon = config.icon;
                  return (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        statusFilter === status
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label} ({statusCounts[status]})
                    </button>
                  );
                })}
              </div>
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

            {/* Units List */}
            <div className="space-y-3">
              {filteredUnits.map((unit) => {
                const status = statusConfig[unit.status];
                const StatusIcon = status.icon;
                const isExpanded = selectedUnit?.id === unit.id;

                return (
                  <div
                    key={unit.id}
                    className={`card overflow-hidden transition-shadow ${
                      isExpanded ? 'shadow-md' : ''
                    }`}
                  >
                    <button
                      onClick={() => setSelectedUnit(isExpanded ? null : unit)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Home className="w-5 h-5 text-gray-600" />
                          </div>
                          <div>
                            <div className="font-semibold">{unit.unitNumber}</div>
                            <div className="text-sm text-gray-500">{unit.property}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={status.badge}>
                            <StatusIcon className="w-3 h-3 mr-1 inline" />
                            {status.label}
                          </span>
                          <ChevronRight
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{unit.type}</span>
                        <span>{unit.bedrooms} bed / {unit.bathrooms} bath</span>
                        <span>KES {unit.monthlyRent.toLocaleString()}/mo</span>
                      </div>

                      {unit.currentTenant && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>{unit.currentTenant.name}</span>
                          {unit.currentTenant.balance > 0 && (
                            <span className="badge-danger text-xs">
                              KES {unit.currentTenant.balance.toLocaleString()} due
                            </span>
                          )}
                        </div>
                      )}

                      {unit.daysVacant !== undefined && (
                        <div className="mt-2 text-sm text-warning-600">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Vacant for {unit.daysVacant} days
                        </div>
                      )}
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-100 space-y-4">
                        {unit.currentTenant && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Current Tenant</span>
                              <Link
                                href={`/customers/${unit.currentTenant.id}`}
                                className="text-sm text-primary-600"
                              >
                                View Profile
                              </Link>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                <span className="text-primary-700 font-medium">
                                  {unit.currentTenant.name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                              <div className="flex-1">
                                <div className="font-medium">{unit.currentTenant.name}</div>
                                <div className="text-sm text-gray-500">
                                  Lease ends: {new Date(unit.currentTenant.leaseEnd).toLocaleDateString()}
                                </div>
                              </div>
                              <a
                                href={`tel:${unit.currentTenant.phone}`}
                                className="btn-secondary"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2">
                          {unit.status === 'VACANT' && (
                            <Link
                              href={`/customers/new?unitId=${unit.id}`}
                              className="btn-primary text-sm flex items-center justify-center gap-2"
                            >
                              <UserPlus className="w-4 h-4" />
                              Start Onboarding
                            </Link>
                          )}
                          {unit.status === 'TURNOVER' && (
                            <Link
                              href={`/work-orders/new?unitId=${unit.id}&type=turnover`}
                              className="btn-primary text-sm flex items-center justify-center gap-2"
                            >
                              <Wrench className="w-4 h-4" />
                              Create Turnover WO
                            </Link>
                          )}
                          <Link
                            href={`/inspections/new?unitId=${unit.id}`}
                            className="btn-secondary text-sm flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Schedule Inspection
                          </Link>
                          <Link
                            href={`/units/${unit.id}/edit`}
                            className="btn-secondary text-sm"
                          >
                            Edit Unit
                          </Link>
                          <button
                            onClick={() => {
                              // Update status modal would go here
                            }}
                            className="btn-secondary text-sm"
                          >
                            Update Status
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredUnits.length === 0 && (
                <div className="text-center py-12">
                  <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900">No units found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery ? 'Try a different search' : 'Add your first unit to get started'}
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
