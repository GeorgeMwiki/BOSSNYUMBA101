'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Building2,
  Loader2,
  Star,
  Clock,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { PriorityBadge } from '@/components/maintenance';
import { workOrdersService, vendorsService } from '@bossnyumba/api-client';

const priorities = [
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

const categories = [
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'APPLIANCE', label: 'Appliances' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'GENERAL', label: 'General' },
];

function normPriority(s: string): 'emergency' | 'high' | 'medium' | 'low' {
  const lower = s.toLowerCase();
  if (['emergency', 'high', 'medium', 'low'].includes(lower)) return lower as 'emergency' | 'high' | 'medium' | 'low';
  return 'medium';
}

function slaColor(rate: number) {
  if (rate >= 95) return 'text-success-600';
  if (rate >= 85) return 'text-warning-600';
  return 'text-danger-600';
}

export default function WorkOrderTriage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const workOrderId = params.id as string;

  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [assigneeType, setAssigneeType] = useState<'technician' | 'vendor' | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch work order from API
  const { data: woData, isLoading: loadingWO } = useQuery({
    queryKey: ['workOrder', workOrderId],
    queryFn: () => workOrdersService.get(workOrderId as never),
    enabled: !!workOrderId,
    retry: false,
  });

  // Fetch vendors from API
  const { data: vendorsData, isLoading: loadingVendors } = useQuery({
    queryKey: ['vendors', 'list', category],
    queryFn: () => vendorsService.list({
      category: category ? category as never : undefined,
      available: true,
    }),
    enabled: assigneeType === 'vendor',
    retry: false,
  });

  const wo = woData?.data as Record<string, unknown> | undefined;
  const unit = wo?.unit as Record<string, unknown> | undefined;
  const property = wo?.property as Record<string, unknown> | undefined;

  // Set initial values from API data
  useMemo(() => {
    if (wo && !priority) {
      setPriority(String(wo.priority ?? 'MEDIUM'));
      setCategory(String(wo.category ?? 'GENERAL'));
    }
  }, [wo, priority]);

  const vendors = useMemo(() => {
    if (!vendorsData?.data?.length) return [];
    return vendorsData.data.map((v) => ({
      id: v.id,
      name: v.companyName || v.name,
      categories: v.categories,
      rating: v.rating ?? 0,
      responseTimeHours: v.responseTimeHours,
      completedJobs: v.completedJobs ?? 0,
    }));
  }, [vendorsData]);

  // Triage mutation
  const triageMutation = useMutation({
    mutationFn: async () => {
      // First triage
      await workOrdersService.triage(workOrderId as never, {
        priority: priority as never,
        category: category as never,
        notes,
      });
      // Then assign if selected
      if (assigneeId) {
        if (assigneeType === 'vendor') {
          await workOrdersService.assign(workOrderId as never, { vendorId: assigneeId });
        } else {
          await workOrdersService.assign(workOrderId as never, { assignedToUserId: assigneeId });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      router.push(`/work-orders/${workOrderId}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triageMutation.mutate();
  };

  if (loadingWO) {
    return (
      <>
        <PageHeader title="Triage Work Order" showBack />
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Triage Work Order" showBack />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        {/* Work Order Summary */}
        <div className="card p-4">
          <div className="text-xs text-gray-400 mb-1">
            {wo?.workOrderNumber ? String(wo.workOrderNumber) : workOrderId}
          </div>
          <h2 className="font-semibold text-lg">{wo?.title ? String(wo.title) : 'Work Order'}</h2>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <span>Unit {unit?.unitNumber ? String(unit.unitNumber) : ''}</span>
            <span>&bull;</span>
            <span>{property?.name ? String(property.name) : ''}</span>
          </div>
          {wo?.description && (
            <p className="text-sm text-gray-600 mt-2">{String(wo.description)}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Priority */}
          <div>
            <label className="label">Set Priority</label>
            <div className="flex gap-2 flex-wrap">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`btn text-sm ${priority === p.value ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {priority && (
              <div className="mt-2">
                <PriorityBadge priority={normPriority(priority)} showDot />
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Assign To */}
          <div>
            <label className="label">Assign To</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setAssigneeType('technician'); setAssigneeId(''); }}
                className={`btn flex-1 ${assigneeType === 'technician' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <User className="w-4 h-4" /> Technician
              </button>
              <button
                type="button"
                onClick={() => { setAssigneeType('vendor'); setAssigneeId(''); }}
                className={`btn flex-1 ${assigneeType === 'vendor' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Building2 className="w-4 h-4" /> Vendor
              </button>
            </div>

            {assigneeType === 'technician' && (
              <select
                className="input"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Select technician</option>
                <option value="tech-1">James Mwangi</option>
                <option value="tech-2">Peter Ochieng</option>
              </select>
            )}

            {assigneeType === 'vendor' && (
              <>
                {loadingVendors ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                    <span className="text-sm text-gray-500 ml-2">Loading vendors...</span>
                  </div>
                ) : vendors.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-500">No vendors available for this category</p>
                    <Link href="/vendors/new" className="text-sm text-primary-600 mt-1 inline-block">Add a vendor</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vendors.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setAssigneeId(v.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          assigneeId === v.id
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{v.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-warning-500 fill-warning-500" />
                                {v.rating.toFixed(1)}
                              </span>
                              {v.responseTimeHours && (
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" />
                                  {v.responseTimeHours}h avg
                                </span>
                              )}
                              <span>{v.completedJobs} jobs</span>
                            </div>
                          </div>
                          {assigneeId === v.id && (
                            <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Triage Notes</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Link href={`/work-orders/${workOrderId}`} className="btn-secondary flex-1">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={triageMutation.isPending}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {triageMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {triageMutation.isPending ? 'Saving...' : 'Complete Triage'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
