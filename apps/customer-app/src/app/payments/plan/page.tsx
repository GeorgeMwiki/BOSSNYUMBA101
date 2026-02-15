'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  DollarSign,
  FileText,
  Check,
  AlertCircle,
  MessageCircle,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { CURRENT_BALANCE } from '@/lib/payments-data';
import { api } from '@/lib/api';

interface PaymentPlanOption {
  id: string;
  months: number;
  monthlyAmount: number;
  totalAmount: number;
  interestRate: number;
  description: string;
}

interface ActivePlanPayment {
  month: number;
  amount: number;
  status: 'paid' | 'pending' | 'upcoming';
  paidDate?: string;
  dueDate?: string;
}

interface ActivePlan {
  id: string;
  status: 'active' | 'completed' | 'defaulted';
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  monthlyAmount: number;
  months: number;
  startDate: string;
  nextPaymentDate: string;
  payments: ActivePlanPayment[];
}

function PaymentPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amountParam = searchParams.get('amount');
  const totalDebt = amountParam ? parseInt(amountParam, 10) : CURRENT_BALANCE;

  const [view, setView] = useState<'new' | 'tracker'>('new');
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);

  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanOption | null>(null);
  const [reason, setReason] = useState('');
  const [preferredStartDate, setPreferredStartDate] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Check for existing active plan
  useEffect(() => {
    const loadActivePlan = async () => {
      setLoadingPlan(true);
      try {
        const plans = await api.payments.getPaymentPlans();
        if (Array.isArray(plans) && plans.length > 0) {
          const active = plans.find(
            (p: ActivePlan) => p.status === 'active'
          );
          if (active) {
            setActivePlan(active);
            setView('tracker');
          }
        }
      } catch {
        // Check localStorage fallback
        const stored = localStorage.getItem('payment_plan_request');
        if (stored) {
          try {
            const req = JSON.parse(stored);
            if (req.status === 'active' || req.status === 'pending') {
              // Create a mock active plan for display
              const mockPlan: ActivePlan = {
                id: req.id || 'pp-local',
                status: 'active',
                totalAmount: req.amount || totalDebt,
                paidAmount: 0,
                remainingAmount: req.amount || totalDebt,
                monthlyAmount: req.plan?.monthlyAmount || Math.ceil(totalDebt / 3),
                months: req.plan?.months || 3,
                startDate: req.preferredStartDate || new Date().toISOString(),
                nextPaymentDate: req.preferredStartDate || new Date().toISOString(),
                payments: [],
              };
              setActivePlan(mockPlan);
              setView('tracker');
            }
          } catch {
            // ignore
          }
        }
      }
      setLoadingPlan(false);
    };
    loadActivePlan();
  }, [totalDebt]);

  // Generate plan options
  const planOptions: PaymentPlanOption[] = [
    {
      id: '2-month',
      months: 2,
      monthlyAmount: Math.ceil(totalDebt / 2),
      totalAmount: totalDebt,
      interestRate: 0,
      description: 'Split into 2 equal payments',
    },
    {
      id: '3-month',
      months: 3,
      monthlyAmount: Math.ceil(totalDebt / 3),
      totalAmount: totalDebt,
      interestRate: 0,
      description: 'Split into 3 equal payments',
    },
    {
      id: '6-month',
      months: 6,
      monthlyAmount: Math.ceil((totalDebt * 1.05) / 6),
      totalAmount: Math.ceil(totalDebt * 1.05),
      interestRate: 5,
      description: '6 months with 5% admin fee',
    },
  ];

  const reasonOptions = [
    'Job loss / Unemployment',
    'Medical emergency',
    'Business difficulties',
    'Unexpected expenses',
    'Delayed salary',
    'Other',
  ];

  const handleSubmit = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);

    try {
      await api.payments.requestPaymentPlan({
        amount: totalDebt,
        months: selectedPlan.months,
        reason,
        startDate: preferredStartDate,
        notes: additionalNotes || undefined,
      });
    } catch {
      // Continue with local storage fallback
    }

    const request = {
      id: `PP-${Date.now()}`,
      createdAt: new Date().toISOString(),
      amount: totalDebt,
      plan: selectedPlan,
      reason,
      preferredStartDate,
      additionalNotes,
      status: 'pending',
    };
    localStorage.setItem('payment_plan_request', JSON.stringify(request));

    setSubmitted(true);
    setIsSubmitting(false);
  };

  if (loadingPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // ====== Tracker View ======
  if (view === 'tracker' && activePlan) {
    const progressPercent =
      activePlan.totalAmount > 0
        ? (activePlan.paidAmount / activePlan.totalAmount) * 100
        : 0;

    return (
      <>
        <PageHeader title="Payment Plan" showBack />

        <div className="px-4 py-4 space-y-6 pb-24">
          {/* Status Card */}
          <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium opacity-90">
                Active Payment Plan
              </span>
            </div>
            <div className="text-3xl font-bold mb-1">
              KES {activePlan.paidAmount.toLocaleString()}
              <span className="text-lg opacity-70">
                {' '}
                / {activePlan.totalAmount.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-sm opacity-80">
              <span>{Math.round(progressPercent)}% paid</span>
              <span>
                KES {activePlan.remainingAmount.toLocaleString()} remaining
              </span>
            </div>
          </div>

          {/* Plan Details */}
          <div className="card p-4">
            <h3 className="font-medium mb-3">Plan Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Monthly Payment</span>
                <span className="font-medium">
                  KES {activePlan.monthlyAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">{activePlan.months} months</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Next Payment</span>
                <span className="font-medium">
                  {new Date(activePlan.nextPaymentDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Timeline */}
          <div className="card p-4">
            <h3 className="font-medium mb-4">Payment Timeline</h3>
            <div className="space-y-4">
              {activePlan.payments.length > 0 ? (
                activePlan.payments.map((payment, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3"
                  >
                    <div className="relative">
                      {payment.status === 'paid' ? (
                        <div className="w-8 h-8 rounded-full bg-success-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      ) : payment.status === 'pending' ? (
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">
                            {idx + 1}
                          </span>
                        </div>
                      )}
                      {idx < activePlan.payments.length - 1 && (
                        <div
                          className={`absolute left-1/2 top-full w-0.5 h-4 -translate-x-1/2 ${
                            payment.status === 'paid'
                              ? 'bg-success-500'
                              : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          Month {payment.month}
                        </span>
                        <span className="font-semibold text-sm">
                          KES {payment.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {payment.status === 'paid' && payment.paidDate
                          ? `Paid on ${new Date(payment.paidDate).toLocaleDateString()}`
                          : payment.dueDate
                          ? `Due ${new Date(payment.dueDate).toLocaleDateString()}`
                          : 'Upcoming'}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        payment.status === 'paid'
                          ? 'badge-success'
                          : payment.status === 'pending'
                          ? 'badge-warning'
                          : 'badge-gray'
                      }`}
                    >
                      {payment.status === 'paid'
                        ? 'Paid'
                        : payment.status === 'pending'
                        ? 'Due'
                        : 'Upcoming'}
                    </span>
                  </div>
                ))
              ) : (
                // Generate placeholder timeline
                Array.from({ length: activePlan.months }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">
                          {idx + 1}
                        </span>
                      </div>
                      {idx < activePlan.months - 1 && (
                        <div className="absolute left-1/2 top-full w-0.5 h-4 -translate-x-1/2 bg-gray-200" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          Month {idx + 1}
                        </span>
                        <span className="font-semibold text-sm">
                          KES {activePlan.monthlyAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {idx === 0 ? 'Pending approval' : 'Upcoming'}
                      </div>
                    </div>
                    <span className="badge-gray text-xs">
                      {idx === 0 ? 'Next' : 'Upcoming'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick pay button */}
          <button
            onClick={() => router.push('/payments/pay')}
            className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2"
          >
            Make Next Payment
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="text-center">
            <a
              href="https://wa.me/254700123456?text=Hi!%20I%20have%20a%20question%20about%20my%20payment%20plan."
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 text-sm flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Need help? Chat with us
            </a>
          </div>
        </div>
      </>
    );
  }

  // ====== Submitted View ======
  if (submitted) {
    return (
      <>
        <PageHeader title="Payment Plan" showBack />
        <div className="px-4 py-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mb-6">
            <Check className="w-12 h-12 text-success-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Request Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your payment plan request has been sent to your property manager for
            review. You&apos;ll receive a response within 2-3 business days.
          </p>

          <div className="card p-4 w-full max-w-sm mb-6">
            <div className="text-sm text-gray-500 mb-2">Requested Plan</div>
            <div className="font-semibold text-lg">
              {selectedPlan?.months} months × KES{' '}
              {selectedPlan?.monthlyAmount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">
              Total: KES {selectedPlan?.totalAmount.toLocaleString()}
            </div>
          </div>

          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={() => router.push('/payments')}
              className="btn-primary flex-1 py-3"
            >
              Back to Payments
            </button>
          </div>

          <div className="mt-6">
            <a
              href="https://wa.me/254700123456?text=Hi!%20I%20submitted%20a%20payment%20plan%20request%20and%20wanted%20to%20follow%20up."
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 text-sm flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Need to discuss? Chat with us
            </a>
          </div>
        </div>
      </>
    );
  }

  // ====== New Plan Request View ======
  return (
    <>
      <PageHeader title="Request Payment Plan" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Current Balance */}
        <div className="card p-5 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
          <div className="text-sm text-primary-700 mb-1">Amount to Split</div>
          <div className="text-3xl font-bold text-primary-800">
            KES {totalDebt.toLocaleString()}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s < step
                  ? 'bg-success-500 text-white'
                  : s === step
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s < step ? <Check className="w-4 h-4" /> : s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                Select a Payment Plan
              </h3>
              <div className="space-y-3">
                {planOptions.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`card p-4 w-full text-left transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'ring-2 ring-primary-500 bg-primary-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-lg">
                          {plan.months} Months
                        </div>
                        <div className="text-sm text-gray-500">
                          {plan.description}
                        </div>
                      </div>
                      {plan.interestRate === 0 && (
                        <span className="badge-success">No fees</span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-primary-600">
                        KES {plan.monthlyAmount.toLocaleString()}
                      </span>
                      <span className="text-gray-500">/month</span>
                    </div>
                    {plan.interestRate > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Total: KES {plan.totalAmount.toLocaleString()} (+
                        {plan.interestRate}% admin fee)
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={() => setStep(2)}
              disabled={!selectedPlan}
              className="btn-primary w-full py-4 disabled:opacity-50"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                Why do you need a payment plan?
              </h3>
              <div className="space-y-2">
                {reasonOptions.map((r) => (
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

            <section>
              <label className="label">Additional details (optional)</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Share any additional context..."
                className="input min-h-[100px]"
              />
            </section>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="btn-secondary flex-1 py-4"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!reason}
                className="btn-primary flex-1 py-4 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <section>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                When can you start paying?
              </h3>
              <input
                type="date"
                value={preferredStartDate}
                onChange={(e) => setPreferredStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input"
              />
            </section>

            <div className="card p-5 bg-gray-50">
              <h3 className="font-semibold mb-4">Payment Plan Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-medium">
                    KES {selectedPlan?.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-medium">
                    {selectedPlan?.months} months
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Payment</span>
                  <span className="font-medium text-primary-600">
                    KES {selectedPlan?.monthlyAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Reason</span>
                  <span className="font-medium">{reason}</span>
                </div>
                {preferredStartDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Start Date</span>
                    <span className="font-medium">
                      {new Date(preferredStartDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm text-gray-600">
              <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <p>
                By submitting this request, you agree to make payments according
                to the approved plan. Failure to pay may result in standard late
                fees.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="btn-secondary flex-1 py-4"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !preferredStartDate}
                className="btn-primary flex-1 py-4 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function PaymentPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      }
    >
      <PaymentPlanContent />
    </Suspense>
  );
}
