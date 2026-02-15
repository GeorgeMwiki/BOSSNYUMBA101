'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Star,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  TrendingUp,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  BarChart3,
  RefreshCcw,
  DollarSign,
  Wrench,
  ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { vendorsService, workOrdersService } from '@bossnyumba/api-client';

// ─── Fallback data ──────────────────────────────────────────────────────────

const fallbackVendor = {
  id: '1',
  vendorNumber: 'VND-2024-0001',
  name: 'QuickFix Plumbing',
  type: 'company',
  status: 'active',
  isAvailable: true,
  contacts: [
    { name: 'John Kamau', phone: '+254 712 345 678', email: 'john@quickfix.co.ke', isPrimary: true },
  ],
  address: 'Industrial Area, Nairobi',
  specializations: ['Plumbing', 'Water Heaters', 'Drainage'],
  rating: 4.8,
  totalRatings: 124,
  completedJobs: 124,
  onTimePercentage: 96,
  hourlyRate: 'KES 2,500',
  callOutFee: 'KES 1,500',
  insuranceExpiry: '2025-06-30',
  // Scorecard metrics
  responseTimeHours: 1.5,
  qualityScore: 92,
  costEfficiency: 88,
  reopenRate: 3,
  slaCompliance: 97,
  // Recent jobs
  recentJobs: [
    { id: '1', workOrderNumber: 'WO-2024-0042', title: 'Kitchen sink leak', completedAt: '2024-02-20', rating: 5, slaStatus: 'met' },
    { id: '2', workOrderNumber: 'WO-2024-0038', title: 'Water heater repair', completedAt: '2024-02-18', rating: 4, slaStatus: 'met' },
    { id: '3', workOrderNumber: 'WO-2024-0031', title: 'Bathroom pipe burst', completedAt: '2024-02-12', rating: 5, slaStatus: 'at_risk' },
    { id: '4', workOrderNumber: 'WO-2024-0025', title: 'Toilet replacement', completedAt: '2024-02-05', rating: 4, slaStatus: 'met' },
  ],
  // Active assignments
  activeAssignments: [
    { id: 'wo-a1', workOrderNumber: 'WO-2024-0049', title: 'Leaking kitchen faucet', unit: 'A-205', priority: 'HIGH', slaStatus: 'pending', dueIn: '6h' },
    { id: 'wo-a2', workOrderNumber: 'WO-2024-0051', title: 'Water tank overflow', unit: 'B-101', priority: 'EMERGENCY', slaStatus: 'at_risk', dueIn: '45m' },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function slaColor(status: string) {
  switch (status) {
    case 'met': return 'text-success-600';
    case 'at_risk': return 'text-warning-600';
    case 'breached': return 'text-danger-600';
    default: return 'text-gray-500';
  }
}

function slaBadgeClass(status: string) {
  switch (status) {
    case 'met': return 'badge-success';
    case 'at_risk': return 'badge-warning';
    case 'breached': return 'badge-danger';
    default: return 'badge-gray';
  }
}

function complianceColor(rate: number) {
  if (rate >= 95) return 'text-success-600';
  if (rate >= 85) return 'text-warning-600';
  return 'text-danger-600';
}

function complianceBg(rate: number) {
  if (rate >= 95) return 'bg-success-500';
  if (rate >= 85) return 'bg-warning-500';
  return 'bg-danger-500';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function VendorDetail() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const vendorId = params?.id as string;
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Fetch vendor from API
  const { data: vendorData, isLoading: loadingVendor } = useQuery({
    queryKey: ['vendor', vendorId],
    queryFn: () => vendorsService.get(vendorId),
    enabled: !!vendorId,
    retry: false,
  });

  // Fetch unassigned work orders for assignment
  const { data: unassignedWO } = useQuery({
    queryKey: ['workOrders', 'unassigned'],
    queryFn: () => workOrdersService.list({ status: ['OPEN', 'TRIAGED'] as never[] }, 1, 50),
    enabled: showAssignModal,
    retry: false,
  });

  const vendor = vendorData?.data
    ? {
        ...fallbackVendor,
        id: vendorData.data.id,
        name: vendorData.data.companyName || vendorData.data.name,
        specializations: vendorData.data.categories,
        rating: vendorData.data.rating ?? fallbackVendor.rating,
        completedJobs: vendorData.data.completedJobs ?? fallbackVendor.completedJobs,
        responseTimeHours: vendorData.data.responseTimeHours ?? fallbackVendor.responseTimeHours,
        isAvailable: vendorData.data.isAvailable,
        contacts: [{ name: vendorData.data.name, phone: vendorData.data.phone, email: vendorData.data.email, isPrimary: true }],
      }
    : fallbackVendor;

  // Mutation: Assign vendor to work order
  const assignMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      return workOrdersService.assign(workOrderId as never, { vendorId: vendor.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      setShowAssignModal(false);
    },
  });

  const unassignedWorkOrders = Array.isArray(unassignedWO?.data) ? unassignedWO.data : [];

  return (
    <>
      <PageHeader
        title={vendor.name}
        showBack
        action={
          <button
            onClick={() => setShowAssignModal(true)}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Wrench className="w-4 h-4" />
            Assign
          </button>
        }
      />

      {loadingVendor ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{vendor.vendorNumber}</span>
                  {vendor.isAvailable ? (
                    <span className="badge-success">Available</span>
                  ) : (
                    <span className="badge-warning">Unavailable</span>
                  )}
                </div>
                <h2 className="text-lg font-semibold mt-1">{vendor.name}</h2>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 text-warning-500 fill-warning-500" />
                <span className="text-xl font-bold">{vendor.rating.toFixed(1)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {vendor.specializations.map((s) => (
                <span key={s} className="badge-info">{s}</span>
              ))}
            </div>
          </div>

          {/* ── Vendor Scorecard ──────────────────────────────────────── */}
          <section className="card p-4">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary-500" />
              Vendor Scorecard
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <ScorecardItem
                label="Response Time"
                value={`${vendor.responseTimeHours}h`}
                icon={<Clock className="w-4 h-4 text-primary-500" />}
                subtitle="Average"
                color="text-primary-600"
              />
              <ScorecardItem
                label="Quality Score"
                value={`${vendor.qualityScore}%`}
                icon={<Star className="w-4 h-4 text-warning-500" />}
                subtitle="Customer ratings"
                color={complianceColor(vendor.qualityScore)}
              />
              <ScorecardItem
                label="Cost Efficiency"
                value={`${vendor.costEfficiency}%`}
                icon={<DollarSign className="w-4 h-4 text-success-500" />}
                subtitle="vs. market avg"
                color={complianceColor(vendor.costEfficiency)}
              />
              <ScorecardItem
                label="Reopen Rate"
                value={`${vendor.reopenRate}%`}
                icon={<RefreshCcw className="w-4 h-4 text-gray-500" />}
                subtitle="Work redone"
                color={vendor.reopenRate <= 5 ? 'text-success-600' : 'text-danger-600'}
              />
            </div>

            {/* SLA Compliance Bar */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  SLA Compliance
                </span>
                <span className={`text-sm font-bold ${complianceColor(vendor.slaCompliance)}`}>
                  {vendor.slaCompliance}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${complianceBg(vendor.slaCompliance)}`}
                  style={{ width: `${Math.min(vendor.slaCompliance, 100)}%` }}
                />
              </div>
            </div>
          </section>

          {/* ── Active Assignments ────────────────────────────────────── */}
          {vendor.activeAssignments.length > 0 && (
            <section className="card p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary-500" />
                Active Assignments
                <span className="badge-primary ml-auto">{vendor.activeAssignments.length}</span>
              </h3>
              <div className="space-y-3">
                {vendor.activeAssignments.map((assignment) => (
                  <Link key={assignment.id} href={`/work-orders/${assignment.id}`}>
                    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-gray-400">{assignment.workOrderNumber}</div>
                          <div className="font-medium text-sm">{assignment.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Unit {assignment.unit} &bull; {assignment.priority}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className={slaBadgeClass(assignment.slaStatus)}>
                            {assignment.slaStatus === 'at_risk' && <AlertTriangle className="w-3 h-3 mr-0.5 inline" />}
                            {assignment.slaStatus === 'met' && <CheckCircle className="w-3 h-3 mr-0.5 inline" />}
                            {assignment.dueIn}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Completed Jobs</span>
              </div>
              <div className="text-2xl font-bold">{vendor.completedJobs}</div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs">On Time</span>
              </div>
              <div className="text-2xl font-bold text-success-600">
                {vendor.onTimePercentage}%
              </div>
            </div>
          </div>

          {/* Rate Card */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Rate Card</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Hourly Rate</span>
                <span className="font-medium">{vendor.hourlyRate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Call-out Fee</span>
                <span className="font-medium">{vendor.callOutFee}</span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Contact</h3>
            <div className="space-y-3">
              {vendor.contacts.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{c.name}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </a>
                    </div>
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-sm text-gray-500">
                        <Mail className="w-3 h-3" />
                        {c.email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {vendor.address && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                {vendor.address}
              </div>
            )}
          </div>

          {/* Recent Jobs with SLA Status */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Recent Jobs</h3>
            <div className="space-y-3">
              {vendor.recentJobs.map((job) => (
                <Link key={job.id} href={`/work-orders/${job.id}`}>
                  <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors">
                    <div>
                      <div className="text-xs text-gray-400">{job.workOrderNumber}</div>
                      <div className="font-medium text-sm">{job.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(job.completedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={slaBadgeClass(job.slaStatus)}>
                        {job.slaStatus === 'met' ? 'SLA Met' : job.slaStatus === 'at_risk' ? 'At Risk' : 'Breached'}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-warning-500 fill-warning-500" />
                        <span>{job.rating}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Insurance */}
          <div className="card p-4">
            <h3 className="font-medium mb-2">Insurance</h3>
            <p className="text-sm text-gray-500">
              Expires: {new Date(vendor.insuranceExpiry).toLocaleDateString()}
            </p>
          </div>

          {/* Actions */}
          <Link href={`/vendors/${vendor.id}/edit`} className="btn-primary w-full">
            Edit Vendor
          </Link>
        </div>
      )}

      {/* ── Assign Work Order Modal ──────────────────────────────────── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowAssignModal(false)}
          />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary-500" />
              Assign Work Order to {vendor.name}
            </h3>

            {unassignedWorkOrders.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-success-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No unassigned work orders available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unassignedWorkOrders.map((wo: { id: string; title?: string; priority?: string; status?: string }) => (
                  <div
                    key={wo.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{wo.title ?? 'Work Order'}</div>
                      <div className="text-xs text-gray-500">
                        {wo.priority} &bull; {wo.status}
                      </div>
                    </div>
                    <button
                      className="btn-primary text-xs"
                      onClick={() => assignMutation.mutate(wo.id)}
                      disabled={assignMutation.isPending}
                    >
                      {assignMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Assign'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-secondary w-full" onClick={() => setShowAssignModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ScorecardItem({
  label,
  value,
  icon,
  subtitle,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{subtitle}</div>
    </div>
  );
}
