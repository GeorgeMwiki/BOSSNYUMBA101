'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  Camera,
  CheckCircle,
  User,
  FileText,
  ClipboardCheck,
  PenLine,
  Home,
  Shield,
  X,
  AlertCircle,
} from 'lucide-react';

type OnboardingStep = 'welcome' | 'id_upload' | 'inspection' | 'signature';

interface StepInfo {
  id: OnboardingStep;
  title: string;
  description: string;
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

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const goToNextStep = () => {
    markStepComplete(currentStep);
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadType) {
      const url = URL.createObjectURL(file);
      if (uploadType === 'front') setIdFrontImage(url);
      else if (uploadType === 'back') setIdBackImage(url);
      else if (uploadType === 'selfie') setSelfieImage(url);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadType(null);
  };

  const openFileSelector = (type: 'front' | 'back' | 'selfie') => {
    setUploadType(type);
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', type === 'selfie' ? 'user' : 'environment');
      fileInputRef.current.click();
    }
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

  const handleComplete = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    localStorage.setItem('onboarding_completed', 'true');
    router.push('/');
  };

  const canProceedFromIdUpload = idFrontImage && idBackImage && selfieImage;
  const canCompleteSignature = hasSignature && agreedToTerms;

  return (
    <div className="min-h-screen bg-gray-50">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Progress Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold">Setup Your Account</h1>
            <span className="text-sm text-gray-500">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex px-4 pb-3 gap-2 overflow-x-auto">
          {STEPS.map((step, idx) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentStep;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                  isCurrent
                    ? 'bg-primary-50 text-primary-700'
                    : isCompleted
                    ? 'bg-success-50 text-success-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="font-medium">{step.title}</span>
              </div>
            );
          })}
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
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Camera className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Take Photos</h4>
                  <p className="text-xs text-gray-500">Document any scratches, stains, or damage</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Add Notes</h4>
                  <p className="text-xs text-gray-500">Describe condition of walls, floors, appliances</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Rate Condition</h4>
                  <p className="text-xs text-gray-500">Mark items as good, fair, or poor condition</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Signature Step */}
        {currentStep === 'signature' && (
          <div className="px-4 py-6 space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Sign Your Lease</h2>
              <p className="text-gray-600 text-sm">
                Review and sign your lease agreement to complete the onboarding.
              </p>
            </div>

            {/* Document Summary */}
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <FileText className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-medium">Lease Agreement</h3>
                  <p className="text-sm text-gray-500">Unit A-204 • 12 months</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-4">
                <div className="flex justify-between">
                  <span>Monthly Rent</span>
                  <span className="font-medium text-gray-900">KES 40,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Start Date</span>
                  <span className="font-medium text-gray-900">June 1, 2024</span>
                </div>
                <div className="flex justify-between">
                  <span>End Date</span>
                  <span className="font-medium text-gray-900">May 31, 2025</span>
                </div>
              </div>
              <a
                href="/onboarding/e-sign"
                className="btn-secondary w-full mt-4 text-sm"
              >
                View Full Document
              </a>
            </div>

            {/* Signature Canvas */}
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Your Signature</h3>
                  {hasSignature && (
                    <button onClick={clearSignature} className="text-sm text-primary-600">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <canvas
                ref={canvasRef}
                width={350}
                height={150}
                className="w-full bg-gray-50 touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-100">
                Sign above using your finger or mouse
              </p>
            </div>

            {/* Terms Agreement */}
            <label className="card p-4 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">
                I have read and agree to the Lease Agreement, House Rules, and Privacy Policy.
                I understand this electronic signature is legally binding.
              </span>
            </label>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex gap-3">
          {currentStepIndex > 0 && (
            <button onClick={goToPreviousStep} className="btn-secondary flex-1 py-4">
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </button>
          )}
          {currentStep === 'signature' ? (
            <button
              onClick={handleComplete}
              disabled={!canCompleteSignature || isSubmitting}
              className="btn-primary flex-1 py-4 text-base font-semibold"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Completing...
                </span>
              ) : (
                'Complete Setup'
              )}
            </button>
          ) : (
            <button
              onClick={goToNextStep}
              disabled={currentStep === 'id_upload' && !canProceedFromIdUpload}
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
