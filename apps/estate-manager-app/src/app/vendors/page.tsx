'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Star,
  Search,
  Filter,
  ChevronRight,
  Phone,
  MessageSquare,
  Clock,
  DollarSign,
  Loader2,
  Plus,
  CheckCircle,
  AlertTriangle,
  Flag,
  BarChart2,
  Wrench,
  Zap,
  Droplets,
  Paintbrush,
  Shield,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { vendorsService } from '@bossnyumba/api-client';

type VendorStatus = 'active' | 'suspended' | 'pending_review';

interface Vendor {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  specializations: string[];
  status: VendorStatus;
  rating: number;
  totalJobs: number;
  completedJobs: number;
  avgResponseTime: string;
  avgCost: number;
  lastJobDate?: string;
  badges: string[];
  performanceScore: number;
  flags: string[];
}

const statusConfig: Record<VendorStatus, { label: string; badge: string }> = {
  active: { label: 'Active', badge: 'badge-success' },
  suspended: { label: 'Suspended', badge: 'badge-danger' },
  pending_review: { label: 'Under Review', badge: 'badge-warning' },
};

const specializationIcons: Record<string, React.ElementType> = {
  Plumbing: Droplets,
  Electrical: Zap,
  HVAC: Wrench,
  Painting: Paintbrush,
  Security: Shield,
  General: Wrench,
};

// Mock data
const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'Peter Ochieng',
    company: 'Quick Fix Plumbing',
    phone: '+254 723 456 789',
    email: 'peter@quickfix.co.ke',
    specializations: ['Plumbing', 'Gas Appliances'],
    status: 'active',
    rating: 4.8,
    totalJobs: 168,
    completedJobs: 156,
    avgResponseTime: '1.5 hours',
    avgCost: 7500,
    lastJobDate: '2024-02-12',
    badges: ['Top Rated', 'Fast Response'],
    performanceScore: 95,
    flags: [],
  },
  {
    id: 'v2',
    name: 'James Mwangi',
    company: 'Reliable Plumbers',
    phone: '+254 734 567 890',
    email: 'james@reliable.co.ke',
    specializations: ['Plumbing', 'Drainage'],
    status: 'active',
    rating: 4.5,
    totalJobs: 95,
    completedJobs: 89,
    avgResponseTime: '3 hours',
    avgCost: 6500,
    lastJobDate: '2024-02-10',
    badges: ['Budget Friendly'],
    performanceScore: 82,
    flags: [],
  },
  {
    id: 'v3',
    name: 'Sarah Njeri',
    company: 'Spark Electric',
    phone: '+254 745 678 901',
    email: 'sarah@spark.co.ke',
    specializations: ['Electrical', 'Security'],
    status: 'active',
    rating: 4.9,
    totalJobs: 234,
    completedJobs: 230,
    avgResponseTime: '2 hours',
    avgCost: 8500,
    lastJobDate: '2024-02-11',
    badges: ['Top Rated', 'Certified'],
    performanceScore: 98,
    flags: [],
  },
  {
    id: 'v4',
    name: 'David Kipchoge',
    company: 'Express Maintenance',
    phone: '+254 756 789 012',
    email: 'david@express.co.ke',
    specializations: ['Plumbing', 'Electrical', 'HVAC'],
    status: 'pending_review',
    rating: 4.2,
    totalJobs: 45,
    completedJobs: 40,
    avgResponseTime: '4 hours',
    avgCost: 9000,
    lastJobDate: '2024-02-08',
    badges: ['Multi-skilled'],
    performanceScore: 72,
    flags: ['Late completions', 'Cost overruns'],
  },
  {
    id: 'v5',
    name: 'Michael Otieno',
    company: 'Cool Air HVAC',
    phone: '+254 767 890 123',
    email: 'michael@coolair.co.ke',
    specializations: ['HVAC'],
    status: 'suspended',
    rating: 3.5,
    totalJobs: 28,
    completedJobs: 20,
    avgResponseTime: '6 hours',
    avgCost: 12000,
    lastJobDate: '2024-01-25',
    badges: [],
    performanceScore: 45,
    flags: ['Multiple complaints', 'No-shows'],
  },
];

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');
  const [specializationFilter, setSpecializationFilter] = useState<string | 'all'>('all');
  const [showFlagModal, setShowFlagModal] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');

  const { data: vendorsData, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  const vendors: Vendor[] = useMemo(() => {
    if (!vendorsData?.data?.length) return MOCK_VENDORS;
    return vendorsData.data as Vendor[];
  }, [vendorsData]);

  const specializations = useMemo(() => {
    const specs = new Set<string>();
    vendors.forEach((v) => v.specializations.forEach((s) => specs.add(s)));
    return Array.from(specs);
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const statusMatch = statusFilter === 'all' || vendor.status === statusFilter;
      const specMatch = specializationFilter === 'all' || vendor.specializations.includes(specializationFilter);
      const searchMatch =
        !searchQuery ||
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.company.toLowerCase().includes(searchQuery.toLowerCase());
      return statusMatch && specMatch && searchMatch;
    });
  }, [vendors, statusFilter, specializationFilter, searchQuery]);

  const handleFlagVendor = async (vendorId: string) => {
    if (!flagReason.trim()) return;
    // Simulate API call
    await new Promise((r) => setTimeout(r, 500));
    // Would update vendor status
    setShowFlagModal(null);
    setFlagReason('');
  };

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} registered vendors`}
        action={
          <Link href="/vendors/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add Vendor
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
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 text-center">
                <div className="text-2xl font-bold text-success-600">
                  {vendors.filter((v) => v.status === 'active').length}
                </div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {vendors.reduce((sum, v) => sum + v.completedJobs, 0)}
                </div>
                <div className="text-xs text-gray-500">Jobs Completed</div>
              </div>
              <div className="card p-3 text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {(vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length).toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">Avg Rating</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <select
                className="input text-sm min-w-[140px]"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VendorStatus | 'all')}
              >
                <option value="all">All Status</option>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <select
                className="input text-sm min-w-[140px]"
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
              >
                <option value="all">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

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

            {/* Vendors List */}
            <div className="space-y-3">
              {filteredVendors.map((vendor) => {
                const status = statusConfig[vendor.status];

                return (
                  <div key={vendor.id} className="card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-700 font-semibold">
                            {vendor.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <div className="font-semibold">{vendor.name}</div>
                          <div className="text-sm text-gray-500">{vendor.company}</div>
                        </div>
                      </div>
                      <span className={status.badge}>{status.label}</span>
                    </div>

                    {/* Specializations */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {vendor.specializations.map((spec) => {
                        const Icon = specializationIcons[spec] || Wrench;
                        return (
                          <span key={spec} className="badge-gray text-xs flex items-center gap-1">
                            <Icon className="w-3 h-3" />
                            {spec}
                          </span>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="font-semibold">{vendor.rating}</span>
                        </div>
                        <div className="text-xs text-gray-400">Rating</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{vendor.completedJobs}</div>
                        <div className="text-xs text-gray-400">Jobs</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-sm">{vendor.avgResponseTime}</div>
                        <div className="text-xs text-gray-400">Response</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-sm">KES {(vendor.avgCost / 1000).toFixed(1)}K</div>
                        <div className="text-xs text-gray-400">Avg Cost</div>
                      </div>
                    </div>

                    {/* Performance Score */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Performance Score</span>
                        <span className={`font-medium ${
                          vendor.performanceScore >= 80 ? 'text-success-600' :
                          vendor.performanceScore >= 60 ? 'text-warning-600' :
                          'text-danger-600'
                        }`}>
                          {vendor.performanceScore}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            vendor.performanceScore >= 80 ? 'bg-success-500' :
                            vendor.performanceScore >= 60 ? 'bg-warning-500' :
                            'bg-danger-500'
                          }`}
                          style={{ width: `${vendor.performanceScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Badges */}
                    {vendor.badges.length > 0 && (
                      <div className="flex gap-1 mb-3">
                        {vendor.badges.map((badge) => (
                          <span key={badge} className="badge-primary text-xs">{badge}</span>
                        ))}
                      </div>
                    )}

                    {/* Flags */}
                    {vendor.flags.length > 0 && (
                      <div className="p-2 bg-warning-50 rounded-lg mb-3">
                        <div className="flex items-center gap-2 text-warning-700 text-sm">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{vendor.flags.join(', ')}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <a href={`tel:${vendor.phone}`} className="btn-secondary flex-1">
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </a>
                      <Link
                        href={`/messaging/new?vendorId=${vendor.id}`}
                        className="btn-secondary flex-1"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Message
                      </Link>
                      <Link href={`/vendors/${vendor.id}`} className="btn-secondary flex-1">
                        <BarChart2 className="w-4 h-4 mr-1" />
                        Scorecard
                      </Link>
                      <button
                        onClick={() => setShowFlagModal(vendor.id)}
                        className="btn-secondary"
                        title="Flag for review"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredVendors.length === 0 && (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900">No vendors found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery ? 'Try a different search' : 'Add your first vendor'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Flag Vendor Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowFlagModal(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Flag className="w-5 h-5 text-warning-500" />
              Flag Vendor for Review
            </h3>
            <p className="text-sm text-gray-500">
              Please provide a reason for flagging this vendor.
            </p>
            <div>
              <label className="label">Reason</label>
              <select
                className="input mb-2"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
              >
                <option value="">Select a reason...</option>
                <option value="poor_quality">Poor quality work</option>
                <option value="late_completion">Consistently late completions</option>
                <option value="cost_overruns">Cost overruns</option>
                <option value="unprofessional">Unprofessional behavior</option>
                <option value="no_show">No-shows</option>
                <option value="customer_complaints">Customer complaints</option>
                <option value="other">Other</option>
              </select>
              <textarea
                className="input min-h-[80px]"
                placeholder="Additional details..."
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowFlagModal(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => handleFlagVendor(showFlagModal)}
                disabled={!flagReason}
                className="btn-warning flex-1"
              >
                Submit Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
