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
  MapPin,
} from 'lucide-react';
import { api } from '@/lib/api';

type OnboardingStep =
  | 'welcome'
  | 'region'
  | 'id_upload'
  | 'inspection'
  | 'signature';

const REGIONS = [
  { code: 'nairobi', label: 'Nairobi' },
  { code: 'mombasa', label: 'Mombasa' },
  { code: 'kisumu', label: 'Kisumu' },
  { code: 'nakuru', label: 'Nakuru' },
  { code: 'eldoret', label: 'Eldoret' },
  { code: 'other', label: 'Other' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

interface StepMeta {
  id: OnboardingStepId;
  title: string;
  icon: React.ElementType;
}

const STEPS: StepInfo[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Get started with your new home',
    icon: Home,
  },
  {
    id: 'region',
    title: 'Region & Language',
    description: 'Help us personalize your experience',
    icon: MapPin,
  },
  {
    id: 'id_upload',
    title: 'ID Verification',
    description: 'Upload your identification',
    icon: Shield,
  },
  {
    id: 'inspection',
    title: 'Move-in Inspection',
    description: 'Document unit condition',
    icon: ClipboardCheck,
  },
  {
    id: 'signature',
    title: 'Sign Documents',
    description: 'Complete your lease agreement',
    icon: PenLine,
  },
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

  // Region & Language state
  const [region, setRegion] = useState<string>('');
  const [language, setLanguage] = useState<string>('en');
  const [preferencesError, setPreferencesError] = useState<string | null>(null);

  // ID Upload state
  const [idFrontImage, setIdFrontImage] = useState<string | null>(null);
  const [idBackImage, setIdBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<'front' | 'back' | 'selfie' | null>(null);

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const markStepComplete = (step: OnboardingStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
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

  // Signature canvas
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
      const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      setHasSignature(false);
    }
  };

  const persistPreferences = async () => {
    if (!region || !language) return;
    try {
      await api.profile.updatePreferences({ region, language });
      setPreferencesError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save region/language';
      setPreferencesError(message);
      throw err;
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Persist region + language on the user record before finalising onboarding.
      // If the region step was skipped somehow, this is a no-op (no fields set).
      if (region && language) {
        try {
          await persistPreferences();
        } catch {
          // preferencesError is already set; surface but don't block completion
          // so an offline customer can still finish. A retry banner is shown.
        }
      }

      localStorage.setItem('onboarding_completed', 'true');
      router.push('/');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedFromRegion = Boolean(region) && Boolean(language);
  const canProceedFromIdUpload = idFrontImage && idBackImage && selfieImage;
  const canCompleteSignature = hasSignature && agreedToTerms;

  const handleContinue = async () => {
    // When leaving the region step, PATCH /users/me so partial progress is
    // persisted even if the user drops off before completion.
    if (currentStep === 'region' && canProceedFromRegion) {
      try {
        await persistPreferences();
      } catch {
        return; // stay on step; error is displayed inline
      }
    }
    goToNextStep();
  };

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

      {/* Content Area */}
      <main className="pb-28">
        {/* Welcome Step */}
        {currentStep === 'welcome' && (
          <div className="px-4 py-8 text-center">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Home className="w-12 h-12 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Welcome to Your New Home!</h2>
            <p className="text-gray-600 mb-8 max-w-sm mx-auto">
              Complete these quick steps to finalize your move-in process and get your keys.
            </p>

            <div className="space-y-4 text-left max-w-sm mx-auto">
              {STEPS.slice(1).map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div key={step.id} className="card p-4 flex items-center gap-4">
                    <div className="p-3 bg-gray-100 rounded-xl">
                      <Icon className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">{step.title}</h3>
                      <p className="text-sm text-gray-500">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Region & Language Step */}
        {currentStep === 'region' && (
          <div className="px-4 py-6 space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Choose Your Region & Language</h2>
              <p className="text-gray-600 text-sm">
                We use this to tailor notifications, billing, and support to you.
              </p>
            </div>

            <div className="card p-4">
              <h3 className="font-medium mb-3">Region</h3>
              <div className="grid grid-cols-2 gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => setRegion(r.code)}
                    className={`px-3 py-3 rounded-lg border text-sm text-left ${
                      region === r.code
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="font-medium mb-3">Language</h3>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    className={`px-3 py-3 rounded-lg border text-sm text-left ${
                      language === l.code
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {preferencesError && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{preferencesError}</span>
              </div>
            )}
          </div>
        )}

        {/* ID Upload Step */}
        {currentStep === 'id_upload' && (
          <div className="px-4 py-6 space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Verify Your Identity</h2>
              <p className="text-gray-600 text-sm">
                Upload clear photos of your ID document and a selfie for verification.
              </p>
            </div>

            {/* ID Front */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">ID Front Side</span>
                </div>
                {idFrontImage && (
                  <span className="badge-success">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Uploaded
                  </span>
                )}
              </div>
              {idFrontImage ? (
                <div className="relative">
                  <img
                    src={idFrontImage}
                    alt="ID Front"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setIdFrontImage(null)}
                    className="absolute top-2 right-2 p-2 bg-danger-500 rounded-full text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openFileSelector('front')}
                  className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
                >
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Take or Upload Photo</span>
                </button>
              )}
            </div>

            {/* ID Back */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">ID Back Side</span>
                </div>
                {idBackImage && (
                  <span className="badge-success">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Uploaded
                  </span>
                )}
              </div>
              {idBackImage ? (
                <div className="relative">
                  <img
                    src={idBackImage}
                    alt="ID Back"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setIdBackImage(null)}
                    className="absolute top-2 right-2 p-2 bg-danger-500 rounded-full text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openFileSelector('back')}
                  className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
                >
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Take or Upload Photo</span>
                </button>
              )}
            </div>

            {/* Selfie */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Selfie Verification</span>
                </div>
                {selfieImage && (
                  <span className="badge-success">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Uploaded
                  </span>
                )}
              </div>
              {selfieImage ? (
                <div className="relative">
                  <img
                    src={selfieImage}
                    alt="Selfie"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setSelfieImage(null)}
                    className="absolute top-2 right-2 p-2 bg-danger-500 rounded-full text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openFileSelector('selfie')}
                  className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
                >
                  <Camera className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Take Selfie</span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-3 text-sm text-gray-600 p-4 bg-gray-50 rounded-xl">
              <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <p>
                Your documents are encrypted and stored securely. We use them only for identity verification.
              </p>
            </div>
          </div>
        )}

        {/* Inspection Step */}
        {currentStep === 'inspection' && (
          <div className="px-4 py-6 space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Move-in Inspection</h2>
              <p className="text-gray-600 text-sm">
                Document the current condition of your unit before moving in.
              </p>
            </div>

            <div className="card p-6 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardCheck className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="font-semibold mb-2">Complete Your Inspection</h3>
              <p className="text-gray-600 text-sm mb-6">
                Walk through each room and document any existing damage or issues. This protects your security deposit.
              </p>
              <a href="/onboarding/inspection" className="btn-primary w-full py-4">
                Start Inspection
                <ChevronRight className="w-5 h-5 ml-1" />
              </a>
            </div>

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
              onClick={handleContinue}
              disabled={
                (currentStep === 'id_upload' && !canProceedFromIdUpload) ||
                (currentStep === 'region' && !canProceedFromRegion)
              }
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
