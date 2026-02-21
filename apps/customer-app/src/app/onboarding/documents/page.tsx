'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Upload,
  X,
  Check,
  AlertCircle,
  FileText,
  CreditCard,
  ChevronRight,
  ArrowLeft,
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DocumentQualityChecker,
  type QualityCheck,
} from '@/components/onboarding/DocumentQualityChecker';

interface DocumentUpload {
  id: string;
  name: string;
  description: string;
  required: boolean;
  accepted: string[];
  file: File | null;
  preview: string | null;
  status: 'pending' | 'uploading' | 'analyzing' | 'uploaded' | 'quality_warning' | 'error';
  error?: string;
  qualityScore?: number;
  qualityChecks?: QualityCheck[];
}

const REQUIRED_DOCUMENTS: Omit<DocumentUpload, 'file' | 'preview' | 'status'>[] = [
  {
    id: 'national_id_front',
    name: 'National ID (Front)',
    description: 'Clear photo of the front of your ID',
    required: true,
    accepted: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'national_id_back',
    name: 'National ID (Back)',
    description: 'Clear photo of the back of your ID',
    required: true,
    accepted: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'proof_of_income',
    name: 'Proof of Income',
    description: 'Pay slip, bank statement, or employment letter',
    required: false,
    accepted: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  {
    id: 'passport_photo',
    name: 'Passport Photo',
    description: 'Recent passport-size photo',
    required: true,
    accepted: ['image/jpeg', 'image/png', 'image/webp'],
  },
];

export default function OnboardingDocumentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentUpload[]>(
    REQUIRED_DOCUMENTS.map((doc) => ({
      ...doc,
      file: null,
      preview: null,
      status: 'pending',
    }))
  );
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);

  const handleFileSelect = (docId: string, file: File) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    // Validate file type
    if (!doc.accepted.includes(file.type)) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, status: 'error', error: 'Invalid file type. Please use JPG, PNG, or PDF.' }
            : d
        )
      );
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? { ...d, status: 'error', error: 'File too large (max 10MB). Please compress or resize.' }
            : d
        )
      );
      return;
    }

    // Create preview for images
    const preview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;

    // Start analyzing
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, file, preview, status: 'analyzing', error: undefined }
          : d
      )
    );
    setAnalyzingDocId(docId);
    setShowQualityModal(true);
  };

  const handleQualityResult = useCallback(
    (passes: boolean, checks: QualityCheck[]) => {
      if (!analyzingDocId) return;

      const passCount = checks.filter((c) => c.status === 'pass').length;
      const qualityScore = Math.round((passCount / checks.length) * 100);

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === analyzingDocId
            ? {
                ...d,
                status: passes ? 'uploaded' : 'quality_warning',
                qualityScore,
                qualityChecks: checks,
              }
            : d
        )
      );

      // Close modal after a delay if passed
      if (passes) {
        setTimeout(() => {
          setShowQualityModal(false);
          setAnalyzingDocId(null);
        }, 1000);
      }
    },
    [analyzingDocId]
  );

  const acceptQualityWarning = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, status: 'uploaded' } : d
      )
    );
    setShowQualityModal(false);
    setAnalyzingDocId(null);
  };

  const retakePhoto = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, file: null, preview: null, status: 'pending', qualityChecks: undefined }
          : d
      )
    );
    setShowQualityModal(false);
    setAnalyzingDocId(null);
    // Trigger camera again
    setTimeout(() => openFilePicker(docId, true), 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDocId) {
      handleFileSelect(activeDocId, file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFilePicker = (docId: string, capture?: boolean) => {
    setActiveDocId(docId);
    if (fileInputRef.current) {
      if (capture) {
        fileInputRef.current.setAttribute('capture', 'environment');
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
  };

  const removeDocument = (docId: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, file: null, preview: null, status: 'pending', error: undefined }
          : d
      )
    );
  };

  const handleSubmit = async () => {
    const requiredDocs = documents.filter((d) => d.required);
    const missingDocs = requiredDocs.filter((d) => d.status !== 'uploaded');

    if (missingDocs.length > 0) {
      setDocuments((prev) =>
        prev.map((d) =>
          missingDocs.some((m) => m.id === d.id)
            ? { ...d, error: 'This document is required' }
            : d
        )
      );
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Save progress
    const progress = JSON.parse(localStorage.getItem('onboarding_progress') || '{}');
    progress.documents = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(progress));

    router.push('/onboarding/inspection');
  };

  const uploadedCount = documents.filter((d) => d.status === 'uploaded').length;
  const requiredCount = documents.filter((d) => d.required).length;
  const canSubmit = documents.filter((d) => d.required && d.status === 'uploaded').length === requiredCount;

  return (
    <>
      <PageHeader title="Upload Documents" showBack />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleInputChange}
      />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Progress */}
        <div className="card p-4 bg-primary-50 border-primary-100">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-primary-700 font-medium">Document Upload</span>
            <span className="text-primary-600">
              {uploadedCount} of {documents.length} uploaded
            </span>
          </div>
          <div className="h-2 bg-primary-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{ width: `${(uploadedCount / documents.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <p>
            Please upload clear, legible photos of your documents. Make sure all text is
            visible and not blurry.
          </p>
        </div>

        {/* Document List */}
        <div className="space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {doc.status === 'uploaded' ? (
                      <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
                        <Check className="w-5 h-5 text-success-600" />
                      </div>
                    ) : doc.status === 'uploading' ? (
                      <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : doc.status === 'error' ? (
                      <div className="w-10 h-10 bg-danger-50 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-danger-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-sm">
                        {doc.name}
                        {doc.required && (
                          <span className="text-danger-500 ml-1">*</span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500">{doc.description}</p>
                    </div>
                  </div>
                  {doc.status === 'uploaded' && (
                    <button
                      onClick={() => removeDocument(doc.id)}
                      className="p-2 text-gray-400 hover:text-danger-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {doc.error && (
                  <p className="text-xs text-danger-600 mt-2">{doc.error}</p>
                )}

                {/* Preview */}
                {doc.preview && doc.status === 'uploaded' && (
                  <div className="mt-3 relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={doc.preview}
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Quality Warning Badge */}
                {doc.status === 'quality_warning' && doc.qualityScore && (
                  <div className="mt-3 p-3 bg-warning-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-warning-700">
                        Quality Score: {doc.qualityScore}%
                      </span>
                      <span className="badge-warning">Needs Review</span>
                    </div>
                    <p className="text-xs text-warning-600 mb-3">
                      The image quality is lower than recommended. You can continue or retake for better results.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => retakePhoto(doc.id)}
                        className="flex-1 btn bg-warning-100 text-warning-700 py-2 text-sm flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Retake
                      </button>
                      <button
                        onClick={() => acceptQualityWarning(doc.id)}
                        className="flex-1 btn bg-warning-600 text-white py-2 text-sm"
                      >
                        Use Anyway
                      </button>
                    </div>
                  </div>
                )}

                {/* Analyzing State */}
                {doc.status === 'analyzing' && (
                  <div className="mt-3 p-3 bg-primary-50 rounded-lg">
                    <div className="flex items-center gap-2 text-primary-700">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span className="text-sm font-medium">Checking document quality...</span>
                    </div>
                  </div>
                )}

                {/* Upload buttons */}
                {doc.status !== 'uploaded' && doc.status !== 'uploading' && doc.status !== 'analyzing' && doc.status !== 'quality_warning' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openFilePicker(doc.id, true)}
                      className="flex-1 btn bg-primary-50 text-primary-600 py-3 flex items-center justify-center gap-2"
                    >
                      <Camera className="w-5 h-5" />
                      Take Photo
                    </button>
                    <button
                      onClick={() => openFilePicker(doc.id, false)}
                      className="flex-1 btn bg-gray-100 text-gray-700 py-3 flex items-center justify-center gap-2"
                    >
                      <ImageIcon className="w-5 h-5" />
                      Gallery
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quality Check Modal */}
      {showQualityModal && analyzingDocId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-4 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Document Quality Check</h3>
              <button
                onClick={() => {
                  setShowQualityModal(false);
                  setAnalyzingDocId(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Preview */}
            {documents.find((d) => d.id === analyzingDocId)?.preview && (
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={documents.find((d) => d.id === analyzingDocId)?.preview || ''}
                  alt="Document preview"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Quality Checker */}
            <DocumentQualityChecker
              imageFile={documents.find((d) => d.id === analyzingDocId)?.file || null}
              onQualityResult={handleQualityResult}
            />

            {/* Actions for quality warning */}
            {documents.find((d) => d.id === analyzingDocId)?.status === 'quality_warning' && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => retakePhoto(analyzingDocId)}
                  className="flex-1 btn-secondary py-3"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retake Photo
                </button>
                <button
                  onClick={() => acceptQualityWarning(analyzingDocId)}
                  className="flex-1 btn-primary py-3"
                >
                  Accept & Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Continue
              <ChevronRight className="w-5 h-5" />
            </span>
          )}
        </button>
      </div>
    </>
  );
}
