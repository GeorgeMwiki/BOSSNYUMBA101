'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle,
  User,
  FileText,
  Home,
  Shield,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  onboarding,
  documents as documentsApi,
  type OnboardingSubmitRequest,
} from '@bossnyumba/api-client';
import { useAuth } from '../contexts/AuthContext';
import {
  INITIAL_ONBOARDING_STATE,
  clearPersistedOnboardingState,
  loadPersistedOnboardingState,
  persistOnboardingState,
  validateOnboardingStep as validateStep,
  type OnboardingFormState,
  type OnboardingStepId,
} from '@/components/onboarding/state';

// Re-export helpers for backwards compatibility and tests that imported
// them from the page module.
export {
  INITIAL_ONBOARDING_STATE,
  clearPersistedOnboardingState,
  loadPersistedOnboardingState,
  persistOnboardingState,
  validateStep,
  type OnboardingFormState,
  type OnboardingStepId,
};

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

interface StepMeta {
  id: OnboardingStepId;
  title: string;
  icon: React.ElementType;
}

const STEPS: StepMeta[] = [
  { id: 'profile', title: 'Profile', icon: User },
  { id: 'property', title: 'Property', icon: Home },
  { id: 'documents', title: 'Documents', icon: FileText },
  { id: 'terms', title: 'Confirm', icon: Shield },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const auth = useAuth() as unknown as {
    user: { id?: string; phone?: string; firstName?: string; lastName?: string } | null;
    token: string | null;
  };
  const [state, setState] = useState<OnboardingFormState>(INITIAL_ONBOARDING_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadPersistedOnboardingState();
    // Seed profile from auth user if nothing persisted yet
    if (
      !persisted.profile.firstName &&
      !persisted.profile.lastName &&
      auth.user
    ) {
      persisted.profile.firstName = auth.user.firstName ?? '';
      persisted.profile.lastName = auth.user.lastName ?? '';
      persisted.profile.phone = auth.user.phone ?? '';
    }
    setState(persisted);
    setHydrated(true);
  }, [auth.user]);

  // Persist every change after initial hydration
  useEffect(() => {
    if (!hydrated) return;
    persistOnboardingState(state);
  }, [state, hydrated]);

  const currentIndex = STEPS.findIndex((s) => s.id === state.currentStep);
  const progress = ((currentIndex + 1) / STEPS.length) * 100;

  const updateProfile = (patch: Partial<OnboardingFormState['profile']>) =>
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));

  const updateProperty = (patch: Partial<OnboardingFormState['property']>) =>
    setState((prev) => ({ ...prev, property: { ...prev.property, ...patch } }));

  const goNext = useCallback(() => {
    const validation = validateStep(state.currentStep, state);
    setErrors(validation.errors);
    if (!validation.ok) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEPS.length) {
      setState((prev) => ({ ...prev, currentStep: STEPS[nextIndex].id }));
      setErrors({});
    }
  }, [currentIndex, state]);

  const goBack = useCallback(() => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setState((prev) => ({ ...prev, currentStep: STEPS[prevIndex].id }));
      setErrors({});
    }
  }, [currentIndex]);

  const handleUploadDocument = useCallback(
    async (file: File, category: string) => {
      setIsUploading(true);
      setErrors((prev) => ({ ...prev, documents: '' }));
      try {
        const response = await documentsApi.uploadDocument({
          file,
          category,
          filename: file.name,
        });
        const doc = response.data;
        setState((prev) => ({
          ...prev,
          documents: [
            ...prev.documents,
            {
              category,
              documentId: doc?.id,
              filename: file.name,
              url: doc?.url,
            },
          ],
        }));
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          documents:
            err instanceof Error ? err.message : 'Failed to upload document',
        }));
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleUploadDocument(file, 'ID_DOCUMENT');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocument = (idx: number) => {
    setState((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = useCallback(async () => {
    const validation = validateStep('terms', state);
    setErrors(validation.errors);
    if (!validation.ok) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload: OnboardingSubmitRequest = {
        profile: {
          firstName: state.profile.firstName.trim(),
          lastName: state.profile.lastName.trim(),
          idNumber: state.profile.idNumber.trim(),
          phone: state.profile.phone.trim(),
        },
        property: {
          propertyId: state.property.propertyId,
          unitId: state.property.unitId || undefined,
        },
        documents: state.documents.map((d) => ({
          category: d.category,
          documentId: d.documentId,
          url: d.url,
          filename: d.filename,
        })),
        agreedToTerms: state.agreedToTerms,
      };
      await onboarding.submit(payload);
      clearPersistedOnboardingState();
      router.push('/');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit onboarding'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [router, state]);

  const stepTitle = useMemo(
    () => STEPS[currentIndex]?.title ?? '',
    [currentIndex]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
        data-testid="onboarding-file-input"
      />

      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold">Setup Your Account</h1>
            <span className="text-sm text-gray-500">
              Step {currentIndex + 1} of {STEPS.length}: {stepTitle}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>
      </header>

      <main className="pb-28 px-4 py-6 space-y-6">
        {/* Profile Step */}
        {state.currentStep === 'profile' && (
          <section aria-labelledby="profile-heading" className="space-y-4">
            <h2 id="profile-heading" className="text-xl font-semibold">
              Your details
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  First name
                </span>
                <input
                  type="text"
                  value={state.profile.firstName}
                  onChange={(e) => updateProfile({ firstName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="text-xs text-danger-600 mt-1">{errors.firstName}</p>
                )}
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Last name
                </span>
                <input
                  type="text"
                  value={state.profile.lastName}
                  onChange={(e) => updateProfile({ lastName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="text-xs text-danger-600 mt-1">{errors.lastName}</p>
                )}
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  ID number
                </span>
                <input
                  type="text"
                  value={state.profile.idNumber}
                  onChange={(e) => updateProfile({ idNumber: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-invalid={!!errors.idNumber}
                />
                {errors.idNumber && (
                  <p className="text-xs text-danger-600 mt-1">{errors.idNumber}</p>
                )}
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">
                  Phone number
                </span>
                <input
                  type="tel"
                  value={state.profile.phone}
                  onChange={(e) => updateProfile({ phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && (
                  <p className="text-xs text-danger-600 mt-1">{errors.phone}</p>
                )}
              </label>
            </div>
          </section>
        )}

        {/* Property Step */}
        {state.currentStep === 'property' && (
          <section aria-labelledby="property-heading" className="space-y-4">
            <h2 id="property-heading" className="text-xl font-semibold">
              Select your property
            </h2>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Property ID
              </span>
              <input
                type="text"
                value={state.property.propertyId}
                onChange={(e) => updateProperty({ propertyId: e.target.value })}
                placeholder="e.g. sunset-apartments-204"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                aria-invalid={!!errors.propertyId}
              />
              {errors.propertyId && (
                <p className="text-xs text-danger-600 mt-1">{errors.propertyId}</p>
              )}
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Unit (optional)
              </span>
              <input
                type="text"
                value={state.property.unitId}
                onChange={(e) => updateProperty({ unitId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </section>
        )}

        {/* Documents Step */}
        {state.currentStep === 'documents' && (
          <section aria-labelledby="documents-heading" className="space-y-4">
            <h2 id="documents-heading" className="text-xl font-semibold">
              Upload documents
            </h2>
            <p className="text-sm text-gray-600">
              Upload a copy of your ID and any supporting documents.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 transition-colors"
            >
              <Upload className="w-6 h-6 mb-1" />
              <span className="text-sm font-medium">
                {isUploading ? 'Uploading...' : 'Choose file'}
              </span>
            </button>

            {errors.documents && (
              <p className="text-xs text-danger-600" role="alert">
                {errors.documents}
              </p>
            )}

            <ul className="space-y-2" data-testid="onboarding-documents-list">
              {state.documents.map((doc, idx) => (
                <li
                  key={`${doc.documentId ?? idx}-${doc.filename}`}
                  className="card p-3 flex items-center gap-3"
                >
                  <FileText className="w-5 h-5 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.filename ?? doc.category}
                    </p>
                    <p className="text-xs text-gray-500">{doc.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDocument(idx)}
                    aria-label={`Remove ${doc.filename ?? 'document'}`}
                    className="p-1 text-gray-400 hover:text-danger-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Terms Step */}
        {state.currentStep === 'terms' && (
          <section aria-labelledby="terms-heading" className="space-y-4">
            <h2 id="terms-heading" className="text-xl font-semibold">
              Review &amp; confirm
            </h2>
            <div className="card p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium">
                  {state.profile.firstName} {state.profile.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <span className="font-medium">{state.profile.idNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium">{state.profile.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Property</span>
                <span className="font-medium">{state.property.propertyId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Documents</span>
                <span className="font-medium">{state.documents.length}</span>
              </div>
            </div>
            <label className="card p-4 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={state.agreedToTerms}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    agreedToTerms: e.target.checked,
                  }))
                }
                className="mt-1 w-5 h-5 rounded"
                aria-invalid={!!errors.agreedToTerms}
              />
              <span className="text-sm text-gray-600">
                I confirm the information is accurate and agree to the Terms of
                Service and Privacy Policy.
              </span>
            </label>
            {errors.agreedToTerms && (
              <p className="text-xs text-danger-600" role="alert">
                {errors.agreedToTerms}
              </p>
            )}
            {submitError && (
              <div
                role="alert"
                className="card p-4 bg-danger-50 border-danger-100 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-800">{submitError}</p>
              </div>
            )}
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex gap-3">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="btn-secondary flex-1 py-4"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>
          )}
          {state.currentStep === 'terms' ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary flex-1 py-4 text-base font-semibold"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                <>
                  Complete Setup
                  <CheckCircle className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="btn-primary flex-1 py-4"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
