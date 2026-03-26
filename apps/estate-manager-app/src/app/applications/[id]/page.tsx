'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText, MapPin, User, Clock, CheckCircle, XCircle, ArrowRight, Building2, Send, AlertTriangle,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-TZ', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(amount / 100);
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: application, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['application', applicationId],
    queryFn: () => applicationsService.get(applicationId).then(r => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Application" showBack />
        <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Application" showBack />
        <div className="px-4 py-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 font-medium mb-1">Failed to load application</p>
          <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
          <button onClick={() => refetch()} className="btn-primary text-sm">Retry</button>
        </div>
      </>
    );
  }

  const app = application as Record<string, unknown> | null;

  return (
    <>
      <PageHeader title={`Application ${(app?.applicationNumber as string) ?? ''}`} showBack />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Status Banner */}
        <div className={`card p-4 ${
          app?.status === 'approved' ? 'bg-green-50 border-green-200' :
          app?.status === 'rejected' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center gap-3">
            {app?.status === 'approved' ? <CheckCircle className="w-6 h-6 text-green-600" /> :
             app?.status === 'rejected' ? <XCircle className="w-6 h-6 text-red-600" /> :
             <Clock className="w-6 h-6 text-blue-600" />}
            <div>
              <div className="font-semibold capitalize">{((app?.status as string) ?? 'pending').replace(/_/g, ' ')}</div>
              <div className="text-sm text-gray-600">
                {app?.requiresDgApproval ? 'Requires DG Approval (Rent >= 500k TZS)' : 'Department-level approval'}
              </div>
            </div>
          </div>
        </div>

        {/* Applicant Info */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" /> Applicant
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Name</div>
              <div className="font-medium">{(app?.applicantName as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Phone</div>
              <div className="font-medium">{(app?.applicantPhone as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Email</div>
              <div className="font-medium">{(app?.applicantEmail as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Address</div>
              <div className="font-medium">{(app?.applicantAddress as string) ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Request Details */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Requested Asset
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Application Type</div>
              <div className="font-medium capitalize">{((app?.type as string) ?? '—').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-gray-500">Asset Type</div>
              <div className="font-medium capitalize">{((app?.assetType as string) ?? '—').replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-gray-500">Location</div>
              <div className="font-medium">{(app?.requestedLocation as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Size</div>
              <div className="font-medium">{(app?.requestedSize as string) ?? '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Proposed Rent</div>
              <div className="font-medium">{app?.proposedRentAmount ? formatCurrency(app.proposedRentAmount as number) : '—'}</div>
            </div>
            <div>
              <div className="text-gray-500">Purpose</div>
              <div className="font-medium">{(app?.purposeOfUse as string) ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Civil Engineering & DG Flags */}
        {(app?.requiresCivilEngReview || app?.requiresDgApproval) && (
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Approval Requirements
            </h3>
            <div className="space-y-2 text-sm">
              {app?.requiresCivilEngReview && (
                <div className="flex items-center gap-2">
                  {app.civilEngApprovedAt ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-orange-500" />}
                  <span>Civil Engineering Notification {app.civilEngApprovedAt ? `— Cleared ${formatDate(app.civilEngApprovedAt as string)}` : '— Pending'}</span>
                </div>
              )}
              {app?.requiresDgApproval && (
                <div className="flex items-center gap-2">
                  {app.dgApprovedAt ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-orange-500" />}
                  <span>DG Approval {app.dgApprovedAt ? `— Approved ${formatDate(app.dgApprovedAt as string)}` : '— Pending'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Routing Timeline */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> Routing Timeline
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium">Letter Received</div>
                <div className="text-gray-500">{formatDate(app?.letterReceivedDate as string)} at {(app?.letterReceivedAt as string) ?? 'station'}</div>
              </div>
            </div>
            {app?.forwardedToHqAt && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">Forwarded to HQ</div>
                  <div className="text-gray-500">{formatDate(app.forwardedToHqAt as string)}</div>
                </div>
              </div>
            )}
            {app?.assignedToEmuAt && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">Assigned to EMU</div>
                  <div className="text-gray-500">{formatDate(app.assignedToEmuAt as string)}</div>
                </div>
              </div>
            )}
            {app?.emuReviewedAt && (
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">EMU Reviewed</div>
                  <div className="text-gray-500">{formatDate(app.emuReviewedAt as string)}</div>
                </div>
              </div>
            )}
            {app?.finalDecisionAt && (
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${app.finalDecision === 'approved' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="text-sm">
                  <div className="font-medium capitalize">{(app.finalDecision as string) ?? 'Decided'}</div>
                  <div className="text-gray-500">{formatDate(app.finalDecisionAt as string)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {/* Action Error */}
        {actionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={async () => {
            const dest = prompt('Forward to (organization/user ID):');
            if (!dest) return;
            try {
              setActionError(null);
              const client = (await import('@bossnyumba/api-client')).getApiClient();
              await client.post(`/applications/${applicationId}/route`, { toOrganizationId: dest });
              queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Failed to forward application');
            }
          }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Forward
          </button>
          <button onClick={async () => {
            if (!confirm('Approve this application?')) return;
            try {
              setActionError(null);
              const client = (await import('@bossnyumba/api-client')).getApiClient();
              await client.post(`/applications/${applicationId}/approve`, {});
              queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
            } catch (err) {
              setActionError(err instanceof Error ? err.message : 'Failed to approve application');
            }
          }} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" /> Approve
          </button>
        </div>
      </div>
    </>
  );
}
