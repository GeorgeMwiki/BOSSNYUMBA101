'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Star,
  Briefcase,
  Loader2,
  Clock,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Filter,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { vendorsService, type Vendor, type VendorCategory } from '@bossnyumba/api-client';

// ─── Fallback mock data ─────────────────────────────────────────────────────

interface VendorListItem {
  id: string;
  vendorNumber: string;
  name: string;
  specializations: string[];
  rating: number;
  totalJobs: number;
  onTimePercentage: number;
  status: string;
  responseTimeHours?: number;
  qualityScore?: number;
  costEfficiency?: number;
  reopenRate?: number;
  slaCompliance?: number;
  isAvailable: boolean;
}

const fallbackVendors: VendorListItem[] = [
  {
    id: '1', vendorNumber: 'VND-2024-0001', name: 'QuickFix Plumbing',
    specializations: ['Plumbing', 'Water Heaters'], rating: 4.8, totalJobs: 124,
    onTimePercentage: 96, status: 'active', responseTimeHours: 1.5,
    qualityScore: 92, costEfficiency: 88, reopenRate: 3, slaCompliance: 97, isAvailable: true,
  },
  {
    id: '2', vendorNumber: 'VND-2024-0002', name: 'Pro Electric Co',
    specializations: ['Electrical', 'HVAC'], rating: 4.6, totalJobs: 89,
    onTimePercentage: 92, status: 'active', responseTimeHours: 2.3,
    qualityScore: 88, costEfficiency: 85, reopenRate: 5, slaCompliance: 91, isAvailable: true,
  },
  {
    id: '3', vendorNumber: 'VND-2024-0003', name: 'General Maintenance Solutions',
    specializations: ['General', 'Structural', 'Appliances'], rating: 4.4, totalJobs: 56,
    onTimePercentage: 88, status: 'active', responseTimeHours: 3.1,
    qualityScore: 82, costEfficiency: 91, reopenRate: 8, slaCompliance: 85, isAvailable: true,
  },
  {
    id: '4', vendorNumber: 'VND-2024-0004', name: 'SecureLock Services',
    specializations: ['Security', 'Locks'], rating: 4.9, totalJobs: 34,
    onTimePercentage: 100, status: 'active', responseTimeHours: 0.8,
    qualityScore: 96, costEfficiency: 82, reopenRate: 1, slaCompliance: 100, isAvailable: true,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function slaColor(rate: number) {
  if (rate >= 95) return 'text-success-600';
  if (rate >= 85) return 'text-warning-600';
  return 'text-danger-600';
}

function slaBadge(rate: number) {
  if (rate >= 95) return 'badge-success';
  if (rate >= 85) return 'badge-warning';
  return 'badge-danger';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VendorsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showScorecard, setShowScorecard] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch vendors from API
  const { data: vendorsData, isLoading } = useQuery({
    queryKey: ['vendors', { search: searchQuery || undefined }],
    queryFn: () => vendorsService.list({
      search: searchQuery || undefined,
      category: categoryFilter !== 'all' ? categoryFilter as VendorCategory : undefined,
    }),
    retry: false,
  });

  // Map API vendors to display format, or use fallback
  const vendors: VendorListItem[] = vendorsData?.data?.length
    ? vendorsData.data.map((v: Vendor) => ({
        id: v.id,
        vendorNumber: `VND-${v.id.slice(0, 8)}`,
        name: v.companyName || v.name,
        specializations: v.categories,
        rating: v.rating ?? 0,
        totalJobs: v.completedJobs ?? 0,
        onTimePercentage: 0,
        status: v.isAvailable ? 'active' : 'inactive',
        responseTimeHours: v.responseTimeHours,
        isAvailable: v.isAvailable,
        qualityScore: undefined,
        costEfficiency: undefined,
        reopenRate: undefined,
        slaCompliance: undefined,
      }))
    : fallbackVendors;

  const filteredVendors = vendors.filter((v) => {
    const searchMatch =
      !searchQuery ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendorNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.specializations.some((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const catMatch =
      categoryFilter === 'all' ||
      v.specializations.some((s) =>
        s.toLowerCase().includes(categoryFilter.toLowerCase())
      );
    return searchMatch && catMatch;
  });

  const categories = ['all', 'Plumbing', 'Electrical', 'HVAC', 'General', 'Security'];

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${filteredVendors.length} vendors`}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowScorecard(!showScorecard)}
              className={`btn text-sm ${showScorecard ? 'btn-primary' : 'btn-secondary'}`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <Link href="/vendors/new" className="btn-primary text-sm">
              <Plus className="w-4 h-4" />
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            className="input pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`btn text-xs ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Vendor List */}
            <div className="space-y-3">
              {filteredVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} showScorecard={showScorecard} />
              ))}
            </div>

            {filteredVendors.length === 0 && (
              <div className="text-center py-12">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900">No vendors found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery ? 'Try a different search' : 'Add your first vendor'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function VendorCard({ vendor, showScorecard }: { vendor: VendorListItem; showScorecard: boolean }) {
  return (
    <Link href={`/vendors/${vendor.id}`}>
      <div className="card p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{vendor.vendorNumber}</span>
              {/* SLA Compliance Indicator */}
              {vendor.slaCompliance !== undefined && (
                <span className={slaBadge(vendor.slaCompliance)}>
                  <Shield className="w-3 h-3 mr-0.5 inline" />
                  {vendor.slaCompliance}% SLA
                </span>
              )}
            </div>
            <h3 className="font-semibold mt-0.5">{vendor.name}</h3>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-warning-500 fill-warning-500" />
            <span className="font-medium">{vendor.rating.toFixed(1)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {vendor.specializations.map((s) => (
            <span key={s} className="badge-gray text-xs">{s}</span>
          ))}
        </div>

        {/* Vendor Scorecard (toggled) */}
        {showScorecard && (
          <div className="grid grid-cols-4 gap-2 mb-3 pt-3 border-t border-gray-100">
            <ScorecardMetric
              label="Response"
              value={vendor.responseTimeHours ? `${vendor.responseTimeHours}h` : '—'}
              icon={<Clock className="w-3 h-3" />}
            />
            <ScorecardMetric
              label="Quality"
              value={vendor.qualityScore ? `${vendor.qualityScore}%` : '—'}
              icon={<Star className="w-3 h-3" />}
              color={vendor.qualityScore ? slaColor(vendor.qualityScore) : undefined}
            />
            <ScorecardMetric
              label="Cost Eff."
              value={vendor.costEfficiency ? `${vendor.costEfficiency}%` : '—'}
              icon={<TrendingUp className="w-3 h-3" />}
            />
            <ScorecardMetric
              label="Reopen"
              value={vendor.reopenRate !== undefined ? `${vendor.reopenRate}%` : '—'}
              icon={<AlertTriangle className="w-3 h-3" />}
              color={vendor.reopenRate !== undefined ? (vendor.reopenRate <= 5 ? 'text-success-600' : 'text-danger-600') : undefined}
            />
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-500 pt-2 border-t border-gray-100">
          <span>{vendor.totalJobs} jobs</span>
          <span className="text-success-600">{vendor.onTimePercentage}% on time</span>
          {!vendor.isAvailable && (
            <span className="badge-warning text-xs ml-auto">Unavailable</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ScorecardMetric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
        {icon}
      </div>
      <div className={`text-sm font-semibold ${color ?? 'text-gray-800'}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
