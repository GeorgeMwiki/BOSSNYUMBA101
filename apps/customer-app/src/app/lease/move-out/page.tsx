'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Clock,
  FileText,
  Truck,
  ClipboardList,
  Key,
  CreditCard,
  Camera,
  Phone,
  Info,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

type MoveOutStep = 'notice' | 'checklist' | 'inspection' | 'confirm' | 'success';

interface ChecklistItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

const MOVE_OUT_REASONS = [
  'Relocating for work',
  'Moving to a bigger/smaller place',
  'End of contract / lease term',
  'Financial reasons',
  'Dissatisfied with the property',
  'Personal / family reasons',
  'Other',
];

const MOVE_OUT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'notice_period',
    icon: FileText,
    title: 'Provide 30-day Notice',
    description: 'Your lease requires 30 days written notice before moving out',
    completed: false,
    required: true,
  },
  {
    id: 'clear_balance',
    icon: CreditCard,
    title: 'Clear Outstanding Balance',
    description: 'Ensure all rent and utility payments are up to date',
    completed: false,
    required: true,
  },
  {
    id: 'schedule_inspection',
    icon: Camera,
    title: 'Schedule Move-Out Inspection',
    description: 'A property inspection is required before vacating',
    completed: false,
    required: true,
  },
  {
    id: 'repair_damage',
    icon: ClipboardList,
    title: 'Repair Any Tenant-Caused Damage',
    description: 'Fix or report any damage beyond normal wear and tear',
    completed: false,
    required: false,
  },
  {
    id: 'clean_unit',
    icon: Home,
    title: 'Deep Clean the Unit',
    description: 'Leave the unit in a clean condition or arrange professional cleaning',
    completed: false,
    required: true,
  },
  {
    id: 'return_keys',
    icon: Key,
    title: 'Return All Keys & Access Cards',
    description: 'Return all keys, remotes, and access cards to management',
    completed: false,
    required: true,
  },
  {
    id: 'forward_address',
    icon: Truck,
    title: 'Provide Forwarding Address',
    description: 'For deposit refund and any correspondence',
    completed: false,
    required: true,
  },
  {
    id: 'disconnect_utilities',
    icon: Clock,
    title: 'Arrange Utility Disconnection',
    description: 'Coordinate final meter readings and disconnection',
    completed: false,
    required: false,
  },
];

const INSPECTION_TIME_SLOTS = [
  { id: 'morning', label: '9:00 AM - 12:00 PM' },
  { id: 'afternoon', label: '1:00 PM - 4:00 PM' },
  { id: 'evening', label: '4:00 PM - 6:00 PM' },
];

export default function MoveOutNoticePage() {
  const router = useRouter();
  const [step, setStep] = useState<MoveOutStep>('notice');

  // Notice form
  const [moveOutDate, setMoveOutDate] = useState('');
  const [reason, setReason] = useState('');
  const [forwardingAddress, setForwardingAddress] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>(MOVE_OUT_CHECKLIST);

  // Inspection scheduling
  const [inspectionDate, setInspectionDate] = useState('');
  const [inspectionTime, setInspectionTime] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Minimum move-out date (30 days from now)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 30);
  const minDateStr = minDate.toISOString().split('T')[0];

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const requiredItemsComplete = checklist
    .filter((i) => i.required)
    .every((i) => i.completed);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      await api.lease.submitMoveOutNotice({
        moveOutDate,
        reason,
        forwardingAddress: forwardingAddress || undefined,
        notes: additionalNotes || undefined,
        inspectionDate: inspectionDate || undefined,
      });
    } catch {
      // Continue
    }

    // Save locally for demo
    localStorage.setItem(
      'move_out_notice',
      JSON.stringify({
        moveOutDate,
        reason,
        forwardingAddress,
        inspectionDate,
        inspectionTime,
        submittedAt: new Date().toISOString(),
      })
    );

    setIsSubmitting(false);
    setStep('success');
  };

  // ====== Success ======
  if (step === 'success') {
    return (
      <>
        <PageHeader title="Move-Out Notice" />
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-24 h-24 bg-success-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-14 h-14 text-success-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Notice Submitted</h2>
          <p className="text-gray-600 mb-6">
            Your move-out notice has been submitted. Your property manager will
            be in touch to confirm the details.
          </p>

          <div className="card p-4 w-full max-w-sm mb-8 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Move-out Date</span>
                <span className="font-medium">
                  {new Date(moveOutDate).toLocaleDateString()}
                </span>
              </div>
              {inspectionDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Inspection</span>
                  <span className="font-medium">
                    {new Date(inspectionDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            <button
              onClick={() => router.push('/lease')}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              View Lease Details
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </button>
          </div>

          <div className="mt-6">
            <a
              href="tel:+254700123456"
              className="text-primary-600 text-sm flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Questions? Call your property manager
            </a>
          </div>
        </div>
      </>
    );
  }

  // ====== Confirm Step ======
  if (step === 'confirm') {
    return (
      <>
        <PageHeader
          title="Confirm Move-Out"
          showBack
        />
        <div className="px-4 py-4 space-y-6 pb-32">
          <div className="card p-4 bg-warning-50 border-warning-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-warning-900">
                  Please Confirm
                </h3>
                <p className="text-sm text-warning-700 mt-1">
                  Submitting this notice is a formal declaration of your intent
                  to vacate. This action cannot be easily undone.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-4">Move-Out Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Move-out Date</span>
                <span className="font-medium">
                  {new Date(moveOutDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Reason</span>
                <span className="font-medium">{reason}</span>
              </div>
              {forwardingAddress && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Forwarding Address</span>
                  <span className="font-medium text-right max-w-[50%]">
                    {forwardingAddress}
                  </span>
                </div>
              )}
              {inspectionDate && (
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Inspection Date</span>
                  <span className="font-medium">
                    {new Date(inspectionDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Checklist Items Done</span>
                <span className="font-medium">
                  {checklist.filter((i) => i.completed).length} /{' '}
                  {checklist.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <p>
              Your security deposit will be refunded (minus any deductions for
              damage) within 30 days of moving out and completing the final
              inspection.
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={() => setStep('inspection')}
              className="btn-secondary flex-1 py-4"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary flex-1 py-4 text-base font-semibold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Notice
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ====== Inspection Scheduling Step ======
  if (step === 'inspection') {
    return (
      <>
        <PageHeader
          title="Schedule Inspection"
          showBack
        />
        <div className="px-4 py-4 space-y-6 pb-32">
          <div className="card p-4 bg-primary-50 border-primary-100">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-primary-600" />
              <div>
                <h3 className="font-medium text-primary-900">
                  Move-Out Inspection
                </h3>
                <p className="text-sm text-primary-700">
                  Schedule an inspection before your move-out date
                </p>
              </div>
            </div>
          </div>

          <section>
            <label className="label">Preferred Inspection Date</label>
            <input
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              max={moveOutDate}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">
              Should be before your move-out date
            </p>
          </section>

          <section>
            <label className="label">Preferred Time Slot</label>
            <div className="space-y-2">
              {INSPECTION_TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setInspectionTime(slot.id)}
                  className={`card p-3 w-full text-left transition-all ${
                    inspectionTime === slot.id
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium">{slot.label}</span>
                    </div>
                    {inspectionTime === slot.id && (
                      <Check className="w-4 h-4 text-primary-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Info className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <p>
              The inspection will compare the unit condition against your move-in
              report. You should be present during the inspection.
            </p>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={() => setStep('checklist')}
              className="btn-secondary flex-1 py-4"
            >
              Back
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={!inspectionDate || !inspectionTime}
              className="btn-primary flex-1 py-4 disabled:opacity-50"
            >
              Review & Submit
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ====== Checklist Step ======
  if (step === 'checklist') {
    return (
      <>
        <PageHeader
          title="Pre-Move-Out Checklist"
          showBack
        />
        <div className="px-4 py-4 space-y-6 pb-32">
          <div className="card p-4 bg-primary-50 border-primary-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary-700 font-medium">Checklist</span>
              <span className="text-primary-600">
                {checklist.filter((i) => i.completed).length} of{' '}
                {checklist.length} done
              </span>
            </div>
            <div className="mt-2 h-2 bg-primary-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (checklist.filter((i) => i.completed).length /
                      checklist.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {checklist.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklistItem(item.id)}
                  className={`card p-4 w-full text-left flex items-start gap-3 transition-all ${
                    item.completed ? 'bg-success-50/50' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0 mt-0.5 transition-colors ${
                      item.completed
                        ? 'bg-success-500 border-success-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {item.completed && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3
                        className={`font-medium text-sm ${
                          item.completed ? 'text-success-700 line-through' : ''
                        }`}
                      >
                        {item.title}
                      </h3>
                      {item.required && !item.completed && (
                        <span className="text-[10px] text-danger-500 font-medium">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${
                      item.completed ? 'text-success-500' : 'text-gray-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {!requiredItemsComplete && (
            <div className="flex items-start gap-3 text-sm text-warning-700">
              <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
              <p>
                Please complete all required items before proceeding.
                Non-required items can be completed later.
              </p>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={() => setStep('notice')}
              className="btn-secondary flex-1 py-4"
            >
              Back
            </button>
            <button
              onClick={() => setStep('inspection')}
              disabled={!requiredItemsComplete}
              className="btn-primary flex-1 py-4 disabled:opacity-50"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ====== Notice Step (Default) ======
  return (
    <>
      <PageHeader title="Move-Out Notice" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Warning */}
        <div className="card p-4 bg-warning-50 border-warning-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-warning-900">Important</h3>
              <p className="text-sm text-warning-700 mt-1">
                A minimum 30-day notice is required as per your lease agreement.
                Early termination may incur additional fees.
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {['Notice', 'Checklist', 'Inspection', 'Confirm'].map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  idx === 0
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {idx + 1}
              </div>
              {idx < 3 && <div className="w-6 h-0.5 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Move-out Date */}
        <section>
          <label className="label">Move-out Date *</label>
          <input
            type="date"
            value={moveOutDate}
            onChange={(e) => setMoveOutDate(e.target.value)}
            min={minDateStr}
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Minimum 30 days from today (
            {minDate.toLocaleDateString()})
          </p>
        </section>

        {/* Reason */}
        <section>
          <label className="label">Reason for Moving Out *</label>
          <div className="space-y-2">
            {MOVE_OUT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`card p-3 w-full text-left transition-all ${
                  reason === r
                    ? 'ring-2 ring-primary-500 bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r}</span>
                  {reason === r && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Forwarding Address */}
        <section>
          <label className="label">Forwarding Address</label>
          <textarea
            value={forwardingAddress}
            onChange={(e) => setForwardingAddress(e.target.value)}
            placeholder="Where should we send your deposit refund?"
            className="input min-h-[80px]"
          />
        </section>

        {/* Additional Notes */}
        <section>
          <label className="label">Additional Notes (optional)</label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any other details or requests..."
            className="input min-h-[80px]"
          />
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={() => setStep('checklist')}
          disabled={!moveOutDate || !reason}
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Continue to Checklist
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}
