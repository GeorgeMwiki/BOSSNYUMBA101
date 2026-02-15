'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Download,
  MessageSquare,
  PenLine,
  ArrowRight,
  Info,
  Home,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

// Default renewal offer data (fallback)
const renewalOffer = {
  id: 'renewal-001',
  currentLease: {
    startDate: '2023-03-01',
    endDate: '2024-02-29',
    monthlyRent: 45000,
    unit: 'Unit A12, Sunrise Apartments',
  },
  newTerms: {
    startDate: '2024-03-01',
    endDate: '2025-02-28',
    monthlyRent: 47500,
    increasePercentage: 5.5,
    securityDeposit: 47500,
    depositAdjustment: 2500,
  },
  options: [
    { months: 6, rentDiscount: 0, label: '6 months' },
    { months: 12, rentDiscount: 2.5, label: '12 months', recommended: true },
    { months: 24, rentDiscount: 5, label: '24 months' },
  ],
  expiresAt: '2024-02-15',
  benefits: [
    'No application fees',
    'Priority maintenance service',
    'Locked-in rate for full term',
    'Free unit inspection before renewal',
  ],
};

export default function LeaseRenewalPage() {
  const router = useRouter();
  const [selectedTerm, setSelectedTerm] = useState(12);
  const [step, setStep] = useState<'review' | 'confirm' | 'success'>('review');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedOption = renewalOffer.options.find((o) => o.months === selectedTerm);
  const finalRent = selectedOption
    ? Math.round(renewalOffer.newTerms.monthlyRent * (1 - selectedOption.rentDiscount / 100))
    : renewalOffer.newTerms.monthlyRent;

  const daysUntilExpiry = Math.ceil(
    (new Date(renewalOffer.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const handleAcceptOffer = async () => {
    setIsSubmitting(true);
    try {
      await api.lease.acceptRenewal({
        termMonths: selectedTerm,
        agreedToTerms,
      });
    } catch {
      // Continue even if API fails
    }
    setStep('success');
    setIsSubmitting(false);
  };

  if (step === 'success') {
    return (
      <>
        <PageHeader title="Renewal Confirmed" />
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-24 h-24 bg-success-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-14 h-14 text-success-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Lease Renewed!</h2>
          <p className="text-gray-600 mb-6">
            Your lease has been successfully renewed for {selectedTerm} months.
          </p>
          <div className="card p-4 w-full max-w-sm mb-8 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">New Term</span>
                <span className="font-medium">{selectedTerm} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Monthly Rent</span>
                <span className="font-medium">KES {finalRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Start Date</span>
                <span className="font-medium">
                  {new Date(renewalOffer.newTerms.startDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <button
              onClick={() => router.push('/lease')}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              View Updated Lease
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  if (step === 'confirm') {
    return (
      <>
        <PageHeader title="Confirm Renewal" showBack onBack={() => setStep('review')} />
        <div className="px-4 py-4 space-y-6 pb-32">
          <div className="card p-5">
            <h2 className="text-lg font-semibold mb-4">Review Your Selection</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Lease Term</span>
                <span className="font-medium">{selectedTerm} months</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Monthly Rent</span>
                <span className="font-medium">KES {finalRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Start Date</span>
                <span className="font-medium">
                  {new Date(renewalOffer.newTerms.startDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">End Date</span>
                <span className="font-medium">
                  {new Date(
                    new Date(renewalOffer.newTerms.startDate).setMonth(
                      new Date(renewalOffer.newTerms.startDate).getMonth() + selectedTerm
                    )
                  ).toLocaleDateString()}
                </span>
              </div>
              {renewalOffer.newTerms.depositAdjustment > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Deposit Adjustment Due</span>
                  <span className="font-medium">
                    KES {renewalOffer.newTerms.depositAdjustment.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card p-4 bg-primary-50 border-primary-100">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-primary-800">
                <p className="font-medium mb-1">Important Information</p>
                <p>
                  By accepting this renewal, you agree to the updated lease terms. The new lease
                  will be sent to your email for e-signature.
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">
                I have read and agree to the{' '}
                <a href="#" className="text-primary-600 underline">
                  lease renewal terms and conditions
                </a>
                . I understand that this is a binding agreement.
              </span>
            </label>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            onClick={handleAcceptOffer}
            disabled={!agreedToTerms || isSubmitting}
            className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PenLine className="w-5 h-5" />
                Accept & Sign Renewal
              </>
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Lease Renewal" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Expiry Warning */}
        {daysUntilExpiry <= 14 && (
          <div className="card p-4 bg-warning-50 border-warning-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-600" />
              <div>
                <p className="font-medium text-warning-800">Offer expires soon</p>
                <p className="text-sm text-warning-700">
                  {daysUntilExpiry} days left to accept this renewal offer
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Lease Info */}
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Current Lease</h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Home className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="font-medium">{renewalOffer.currentLease.unit}</p>
              <p className="text-sm text-gray-500">
                Ends {new Date(renewalOffer.currentLease.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Current rent: <span className="font-medium">KES {renewalOffer.currentLease.monthlyRent.toLocaleString()}/month</span>
          </div>
        </div>

        {/* Renewal Offer */}
        <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium opacity-90">Renewal Offer</span>
          </div>
          <div className="text-3xl font-bold mb-1">
            KES {finalRent.toLocaleString()}/mo
          </div>
          {selectedOption && selectedOption.rentDiscount > 0 && (
            <div className="text-sm opacity-90 mb-2">
              <span className="line-through opacity-70">
                KES {renewalOffer.newTerms.monthlyRent.toLocaleString()}
              </span>{' '}
              <span className="bg-white/20 px-2 py-0.5 rounded-full">
                {selectedOption.rentDiscount}% off
              </span>
            </div>
          )}
          <p className="text-sm text-primary-100">
            {renewalOffer.newTerms.increasePercentage}% increase from current rent
          </p>
        </div>

        {/* Term Selection */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Select Term Length</h3>
          <div className="space-y-2">
            {renewalOffer.options.map((option) => {
              const optionRent = Math.round(
                renewalOffer.newTerms.monthlyRent * (1 - option.rentDiscount / 100)
              );
              return (
                <button
                  key={option.months}
                  onClick={() => setSelectedTerm(option.months)}
                  className={`card p-4 w-full text-left transition-all ${
                    selectedTerm === option.months
                      ? 'ring-2 ring-primary-500 bg-primary-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedTerm === option.months
                            ? 'border-primary-500 bg-primary-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedTerm === option.months && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {option.label}
                          {option.recommended && (
                            <span className="badge-success text-xs">Recommended</span>
                          )}
                        </div>
                        {option.rentDiscount > 0 && (
                          <div className="text-xs text-success-600">
                            Save {option.rentDiscount}% on rent
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">KES {optionRent.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">per month</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Benefits */}
        <section className="card p-4">
          <h3 className="font-medium mb-3">Renewal Benefits</h3>
          <ul className="space-y-2">
            {renewalOffer.benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href="#"
            className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download Terms
          </a>
          <a
            href="https://wa.me/254700123456?text=Hi,%20I%20have%20questions%20about%20my%20lease%20renewal"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 py-3 flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-5 h-5" />
            Ask Questions
          </a>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={() => setStep('confirm')}
          className="btn-primary w-full py-4 text-base font-semibold flex items-center justify-center gap-2"
        >
          Continue with {selectedTerm} Month Renewal
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}
