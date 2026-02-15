'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  FileText,
  ClipboardCheck,
  PenLine,
  Key,
  ChevronRight,
  Check,
  Clock,
  AlertTriangle,
  Phone,
  MessageSquare,
  Send,
  Copy,
  CheckCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type OnboardingStep = 'invite_sent' | 'documents' | 'inspection' | 'signing' | 'handover' | 'complete';

interface OnboardingProgress {
  customerId: string;
  customerName: string;
  customerPhone: string;
  unit: { id: string; number: string; property: string };
  status: OnboardingStep;
  leaseStart: string;
  steps: {
    invite: { status: 'pending' | 'sent' | 'clicked' | 'complete'; sentAt?: string; clickedAt?: string };
    documents: { status: 'pending' | 'in_progress' | 'review' | 'approved' | 'rejected'; uploadedAt?: string; files?: string[] };
    inspection: { status: 'pending' | 'scheduled' | 'in_progress' | 'complete'; scheduledDate?: string; completedAt?: string };
    signing: { status: 'pending' | 'ready' | 'signed'; signedAt?: string };
    handover: { status: 'pending' | 'ready' | 'complete'; completedAt?: string; keysHandedOver?: boolean };
  };
  whatsappLink: string;
  createdAt: string;
}

const stepConfig: Record<OnboardingStep, { label: string; icon: React.ElementType }> = {
  invite_sent: { label: 'Invite Sent', icon: Send },
  documents: { label: 'Document Upload', icon: FileText },
  inspection: { label: 'Move-In Inspection', icon: ClipboardCheck },
  signing: { label: 'Lease Signing', icon: PenLine },
  handover: { label: 'Key Handover', icon: Key },
  complete: { label: 'Complete', icon: CheckCircle },
};

// Mock data
const MOCK_PROGRESS: OnboardingProgress = {
  customerId: 'c1',
  customerName: 'John Kamau',
  customerPhone: '+254 712 345 678',
  unit: { id: 'u1', number: 'A-101', property: 'Sunset Apartments' },
  status: 'documents',
  leaseStart: '2024-03-01',
  steps: {
    invite: { status: 'complete', sentAt: '2024-02-10T10:00:00', clickedAt: '2024-02-10T10:15:00' },
    documents: { status: 'review', uploadedAt: '2024-02-12T14:30:00', files: ['National ID', 'Proof of Income', 'Passport Photo'] },
    inspection: { status: 'pending' },
    signing: { status: 'pending' },
    handover: { status: 'pending' },
  },
  whatsappLink: 'https://wa.me/254712345678?text=Welcome%20to%20BOSSNYUMBA!',
  createdAt: '2024-02-10T09:00:00',
};

export default function CustomerOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    // Simulate fetching onboarding progress
    setTimeout(() => {
      setProgress(MOCK_PROGRESS);
      setIsLoading(false);
    }, 500);
  }, [params.id]);

  const copyInviteLink = async () => {
    if (!progress) return;
    await navigator.clipboard.writeText(progress.whatsappLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const resendInvite = async () => {
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsProcessing(false);
    // Would trigger API to resend
  };

  const approveDocuments = async () => {
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            status: 'inspection',
            steps: { ...prev.steps, documents: { ...prev.steps.documents, status: 'approved' } },
          }
        : null
    );
    setIsProcessing(false);
  };

  const rejectDocuments = async (reason: string) => {
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            steps: { ...prev.steps, documents: { ...prev.steps.documents, status: 'rejected' } },
          }
        : null
    );
    setIsProcessing(false);
  };

  const scheduleInspection = async () => {
    // Would open date picker modal
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            steps: {
              ...prev.steps,
              inspection: { status: 'scheduled', scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString() },
            },
          }
        : null
    );
    setIsProcessing(false);
  };

  const completeHandover = async () => {
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    setProgress((prev) =>
      prev
        ? {
            ...prev,
            status: 'complete',
            steps: {
              ...prev.steps,
              handover: { status: 'complete', completedAt: new Date().toISOString(), keysHandedOver: true },
            },
          }
        : null
    );
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-warning-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Onboarding not found</h2>
      </div>
    );
  }

  const steps: OnboardingStep[] = ['invite_sent', 'documents', 'inspection', 'signing', 'handover', 'complete'];
  const currentStepIndex = steps.indexOf(progress.status);

  return (
    <>
      <PageHeader title="Customer Onboarding" showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Customer Info */}
        <div className="card p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-xl font-semibold text-primary-700">
                {progress.customerName.split(' ').map((n) => n[0]).join('')}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">{progress.customerName}</h2>
              <div className="text-sm text-gray-500">{progress.customerPhone}</div>
              <div className="text-sm text-gray-500">
                Unit {progress.unit.number} • {progress.unit.property}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a href={`tel:${progress.customerPhone}`} className="btn-secondary">
                <Phone className="w-4 h-4" />
              </a>
              <Link href={`/messaging/new?customerId=${progress.customerId}`} className="btn-secondary">
                <MessageSquare className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Lease Start Date</span>
            <span className="font-medium">{new Date(progress.leaseStart).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Onboarding Progress</h3>
          <div className="relative">
            {steps.slice(0, -1).map((step, index) => {
              const config = stepConfig[step];
              const Icon = config.icon;
              const isComplete = index < currentStepIndex || (index === currentStepIndex && progress.status === 'complete');
              const isCurrent = index === currentStepIndex && progress.status !== 'complete';
              const isPending = index > currentStepIndex;

              return (
                <div key={step} className="flex items-start gap-4 mb-4 last:mb-0">
                  <div className="relative">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isComplete
                          ? 'bg-success-500 text-white'
                          : isCurrent
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    {index < steps.length - 2 && (
                      <div
                        className={`absolute left-1/2 top-10 w-0.5 h-8 -translate-x-1/2 ${
                          isComplete ? 'bg-success-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${isPending ? 'text-gray-400' : ''}`}>
                        {config.label}
                      </span>
                      {isComplete && <span className="badge-success text-xs">Complete</span>}
                      {isCurrent && <span className="badge-primary text-xs">In Progress</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step-Specific Actions */}
        {/* Invite Step */}
        {progress.status === 'invite_sent' && (
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold">WhatsApp Invite</h3>
            <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={progress.whatsappLink}
                className="flex-1 bg-transparent text-sm truncate"
              />
              <button onClick={copyInviteLink} className="btn-secondary">
                {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={resendInvite} disabled={isProcessing} className="btn-secondary flex-1">
                <RefreshCw className={`w-4 h-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
                Resend Invite
              </button>
              <a
                href={`https://wa.me/${progress.customerPhone.replace(/\s/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 text-center"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Open WhatsApp
              </a>
            </div>
            <p className="text-xs text-gray-500">
              Invite sent {progress.steps.invite.sentAt && new Date(progress.steps.invite.sentAt).toLocaleString()}
              {progress.steps.invite.clickedAt && ` • Clicked ${new Date(progress.steps.invite.clickedAt).toLocaleString()}`}
            </p>
          </div>
        )}

        {/* Documents Step */}
        {progress.status === 'documents' && (
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold">Document Review</h3>
            {progress.steps.documents.status === 'review' ? (
              <>
                <div className="p-3 bg-warning-50 rounded-lg border border-warning-200">
                  <div className="flex items-center gap-2 text-warning-700">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Documents pending review</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {progress.steps.documents.files?.map((file) => (
                    <div key={file} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{file}</span>
                      </div>
                      <Link
                        href={`/customers/${params.id}/documents?file=${encodeURIComponent(file)}`}
                        className="text-primary-600 text-sm"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => rejectDocuments('Additional documents required')}
                    disabled={isProcessing}
                    className="btn-danger flex-1"
                  >
                    Request Re-upload
                  </button>
                  <button onClick={approveDocuments} disabled={isProcessing} className="btn-primary flex-1">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Approve Documents'}
                  </button>
                </div>
              </>
            ) : progress.steps.documents.status === 'approved' ? (
              <div className="p-3 bg-success-50 rounded-lg border border-success-200">
                <div className="flex items-center gap-2 text-success-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Documents approved</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Waiting for customer to upload documents</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inspection Step */}
        {progress.status === 'inspection' && (
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold">Move-In Inspection</h3>
            {progress.steps.inspection.status === 'pending' ? (
              <>
                <p className="text-sm text-gray-500">
                  Schedule a move-in inspection with the customer.
                </p>
                <button onClick={scheduleInspection} disabled={isProcessing} className="btn-primary w-full">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Schedule Inspection
                </button>
              </>
            ) : progress.steps.inspection.status === 'scheduled' ? (
              <>
                <div className="p-3 bg-primary-50 rounded-lg border border-primary-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-primary-700 font-medium">Scheduled</span>
                      <div className="text-sm text-primary-600">
                        {progress.steps.inspection.scheduledDate &&
                          new Date(progress.steps.inspection.scheduledDate).toLocaleString()}
                      </div>
                    </div>
                    <Link
                      href={`/inspections/${progress.unit.id}/conduct`}
                      className="btn-primary text-sm"
                    >
                      Start Inspection
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-3 bg-success-50 rounded-lg border border-success-200">
                <div className="flex items-center gap-2 text-success-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Inspection complete</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Signing Step */}
        {progress.status === 'signing' && (
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold">Lease Signing</h3>
            <p className="text-sm text-gray-500">
              The customer is ready to sign their lease agreement.
            </p>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Waiting for customer signature in the app</span>
              </div>
            </div>
          </div>
        )}

        {/* Handover Step */}
        {progress.status === 'handover' && (
          <div className="card p-4 space-y-4">
            <h3 className="font-semibold">Key Handover</h3>
            <p className="text-sm text-gray-500">
              Complete the key handover to finalize the onboarding process.
            </p>
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <h4 className="font-medium text-primary-800 mb-2">Handover Checklist</h4>
              <ul className="space-y-2 text-sm text-primary-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Documents verified
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Inspection completed
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Lease signed
                </li>
                <li className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Hand over keys
                </li>
              </ul>
            </div>
            <button onClick={completeHandover} disabled={isProcessing} className="btn-primary w-full">
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Key className="w-4 h-4 mr-2" />
              )}
              Complete Handover
            </button>
          </div>
        )}

        {/* Complete */}
        {progress.status === 'complete' && (
          <div className="card p-6 text-center space-y-4 bg-success-50 border-success-200">
            <CheckCircle className="w-16 h-16 text-success-500 mx-auto" />
            <h3 className="text-xl font-semibold text-success-800">Onboarding Complete!</h3>
            <p className="text-success-700">
              {progress.customerName} has been successfully onboarded to {progress.unit.number}.
            </p>
            <Link href={`/customers/${params.id}`} className="btn-primary">
              View Customer Profile
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
