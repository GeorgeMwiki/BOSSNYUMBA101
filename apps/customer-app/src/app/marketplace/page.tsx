'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@bossnyumba/api-client';
import type { Vendor, VendorCategory } from '@bossnyumba/api-client';
import { ShoppingBag, AlertTriangle, Search, Star, Briefcase, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

const CATEGORIES: { label: string; value: VendorCategory | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Plumbing', value: 'PLUMBING' },
  { label: 'Electrical', value: 'ELECTRICAL' },
  { label: 'HVAC', value: 'HVAC' },
  { label: 'General', value: 'GENERAL' },
  { label: 'Appliance', value: 'APPLIANCE' },
  { label: 'Structural', value: 'STRUCTURAL' },
];

function MarketplaceSkeleton() {
  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="h-11 bg-surface-card rounded-xl animate-pulse" />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-surface-card rounded-full animate-pulse flex-shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-surface-card rounded-xl p-4 space-y-3 animate-pulse">
            <div className="w-12 h-12 bg-white/5 rounded-full" />
            <div className="h-4 w-3/4 bg-white/5 rounded" />
            <div className="h-3 w-1/2 bg-white/5 rounded" />
            <div className="h-3 w-2/3 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyMarketplace() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="p-4 bg-surface-card rounded-full mb-4">
        <ShoppingBag className="w-10 h-10 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">No vendors available</h2>
      <p className="text-gray-400 text-sm">Check back later for available service providers.</p>
    </div>
  );
}

function MarketplaceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load marketplace</h2>
      <p className="text-gray-400 text-sm mb-6">Something went wrong. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2">
        Retry
      </button>
    </div>
  );
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  return (
    <div className="bg-surface-card rounded-xl p-4 space-y-3">
      <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
        <Briefcase className="w-6 h-6 text-primary-400" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-white truncate">{vendor.name}</h3>
        {vendor.companyName && (
          <p className="text-xs text-gray-500 truncate">{vendor.companyName}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {vendor.categories.slice(0, 2).map((cat) => (
          <span key={cat} className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-gray-400">
            {cat}
          </span>
        ))}
        {vendor.categories.length > 2 && (
          <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-gray-400">
            +{vendor.categories.length - 2}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        {vendor.rating ? (
          <div className="flex items-center gap-1 text-yellow-400">
            <Star className="w-3.5 h-3.5 fill-yellow-400" />
            <span>{vendor.rating.toFixed(1)}</span>
          </div>
        ) : (
          <span className="text-gray-500">No rating</span>
        )}
        {vendor.responseTimeHours && (
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{vendor.responseTimeHours}h</span>
          </div>
        )}
      </div>
      {vendor.completedJobs !== undefined && (
        <p className="text-[10px] text-gray-500">{vendor.completedJobs} jobs completed</p>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<VendorCategory | 'ALL'>('ALL');

  const { data: vendors, isLoading, isError, refetch } = useQuery<Vendor[]>(
    '/vendors',
    { staleTime: 60 * 1000 }
  );

  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.filter((v) => {
      const matchesSearch =
        !search ||
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.companyName?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === 'ALL' || v.categories.includes(selectedCategory as VendorCategory);
      return matchesSearch && matchesCategory;
    });
  }, [vendors, search, selectedCategory]);

  return (
    <div>
      <PageHeader title="Marketplace" showSettings />

      {isLoading ? (
        <MarketplaceSkeleton />
      ) : isError ? (
        <MarketplaceError onRetry={refetch} />
      ) : (
        <div className="px-4 pt-4 pb-24 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendors..."
              className="w-full bg-surface-card text-white placeholder-gray-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors min-h-[32px] ${
                  selectedCategory === cat.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-card text-gray-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Vendor grid */}
          {filteredVendors.length === 0 ? (
            <EmptyMarketplace />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredVendors.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
