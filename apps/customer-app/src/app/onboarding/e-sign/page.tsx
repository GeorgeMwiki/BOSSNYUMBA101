'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  PenLine,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ESignature } from '@/components/ESignature';
import { api } from '@/lib/api';

interface Document {
  id: string;
  name: string;
  type: 'lease' | 'inspection' | 'rules';
  summary: string;
  sections: DocumentSection[];
  signed: boolean;
  signedAt?: string;
  signatureData?: string;
}

interface DocumentSection {
  title: string;
  content: string;
}

const DOCUMENTS: Document[] = [
  {
    id: 'lease',
    name: 'Lease Agreement',
    type: 'lease',
    summary:
      'Your 12-month residential lease agreement for Unit A-204 at Sunset Apartments.',
    sections: [
      {
        title: 'Term of Lease',
        content:
          'This lease begins on June 1, 2024 and ends on May 31, 2025. The monthly rent is KES 40,000, due on the 1st of each month.',
      },
      {
        title: 'Security Deposit',
        content:
          'A security deposit of KES 80,000 (equivalent to 2 months rent) has been paid and will be held for the duration of the lease.',
      },
      {
        title: 'Maintenance & Repairs',
        content:
          'The landlord is responsible for major repairs and maintenance. The tenant must report any issues promptly through the app.',
      },
      {
        title: 'Rules & Regulations',
        content:
          'The tenant agrees to abide by all property rules, including quiet hours (10pm-7am), parking regulations, and common area usage guidelines.',
      },
    ],
    signed: false,
  },
  {
    id: 'inspection',
    name: 'Move-in Condition Report',
    type: 'inspection',
    summary:
      'Document confirming the condition of the unit at move-in.',
    sections: [
      {
        title: 'Unit Condition',
        content:
          'Based on your move-in inspection, this report documents the current condition of all rooms, fixtures, and appliances in the unit.',
      },
      {
        title: 'Acknowledgment',
        content:
          'By signing, you confirm that the condition report accurately reflects the state of the unit at the time of move-in.',
      },
    ],
    signed: false,
  },
  {
    id: 'rules',
    name: 'House Rules Agreement',
    type: 'rules',
    summary: 'Property rules and community guidelines.',
    sections: [
      {
        title: 'Quiet Hours',
        content:
          'Quiet hours are observed from 10:00 PM to 7:00 AM daily. Please be considerate of neighbors during these times.',
      },
      {
        title: 'Common Areas',
        content:
          'Common areas including the lobby, gym, and rooftop are for resident use only. Guests must be accompanied at all times.',
      },
      {
        title: 'Parking',
        content:
          'Each unit is assigned one parking space. Additional parking is available on a first-come, first-served basis.',
      },
    ],
    signed: false,
  },
];

export default function OnboardingESignPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(DOCUMENTS);
  const [expandedDocId, setExpandedDocId] = useState<string | null>('lease');
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allSigned = documents.every((doc) => doc.signed);
  const canComplete = allSigned && agreedToTerms;

  const openSignatureModal = (docId: string) => {
    setActiveDocId(docId);
    setShowSignatureModal(true);
  };

  const handleSignatureSave = (signatureDataUrl: string) => {
    if (activeDocId) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === activeDocId
            ? {
                ...doc,
                signed: true,
                signedAt: new Date().toISOString(),
                signatureData: signatureDataUrl,
              }
            : doc
        )
      );
      setShowSignatureModal(false);
      setActiveDocId(null);
    }
  };

  const handleComplete = async () => {
    if (!canComplete) return;

    setIsSubmitting(true);

    try {
      await api.onboarding.updateStep('e-sign', {
        documents: documents.map((d) => ({
          id: d.id,
          signed: d.signed,
          signedAt: d.signedAt,
        })),
      });
    } catch {
      // Continue
    }

    // Save progress
    const savedProgress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}'
    );
    savedProgress['e-sign'] = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(savedProgress));

    router.push('/onboarding/complete');
  };

  return (
    <>
      <PageHeader title="Sign Documents" showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {/* Progress Summary */}
        <div className="card p-4 bg-primary-50 border-primary-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <PenLine className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-medium text-primary-900">
                  Documents to Sign
                </h3>
                <p className="text-sm text-primary-700">
                  {documents.filter((d) => d.signed).length} of{' '}
                  {documents.length} signed
                </p>
              </div>
            </div>
            {allSigned && <span className="badge-success">All Signed</span>}
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          {documents.map((doc) => (
            <div key={doc.id} className="card overflow-hidden">
              {/* Document Header */}
              <button
                onClick={() =>
                  setExpandedDocId(expandedDocId === doc.id ? null : doc.id)
                }
                className="w-full p-4 flex items-start gap-3 text-left"
              >
                <div
                  className={`p-2 rounded-lg ${
                    doc.signed ? 'bg-success-50' : 'bg-gray-100'
                  }`}
                >
                  <FileText
                    className={`w-5 h-5 ${
                      doc.signed ? 'text-success-600' : 'text-gray-600'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{doc.name}</h3>
                    {doc.signed && (
                      <Check className="w-4 h-4 text-success-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{doc.summary}</p>
                </div>
                {expandedDocId === doc.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Document Content */}
              {expandedDocId === doc.id && (
                <div className="border-t border-gray-100">
                  <div className="p-4 space-y-4">
                    {doc.sections.map((section, idx) => (
                      <div key={idx}>
                        <h4 className="font-medium text-sm text-gray-900 mb-1">
                          {section.title}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Signature preview if signed */}
                  {doc.signed && doc.signatureData && (
                    <div className="px-4 pb-2">
                      <div className="border rounded-lg p-2 bg-success-50 border-success-200">
                        <img
                          src={doc.signatureData}
                          alt="Signature"
                          className="h-12 mx-auto"
                        />
                        <p className="text-xs text-success-600 text-center mt-1">
                          Signed on{' '}
                          {new Date(doc.signedAt!).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-4 border-t border-gray-100 flex gap-3">
                    <button className="btn-secondary flex-1 text-sm">
                      <Eye className="w-4 h-4 mr-1" />
                      View Full Document
                    </button>
                    {doc.signed ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-success-600 font-medium">
                        <Check className="w-4 h-4 mr-1" />
                        Signed
                      </div>
                    ) : (
                      <button
                        onClick={() => openSignatureModal(doc.id)}
                        className="btn-primary flex-1 text-sm"
                      >
                        <PenLine className="w-4 h-4 mr-1" />
                        Sign Document
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Terms Agreement */}
        {allSigned && (
          <div className="card p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">
                I confirm that I have read and understood all documents, and I
                agree to be bound by the terms and conditions outlined in the
                lease agreement and house rules.
              </span>
            </label>
          </div>
        )}

        {/* Important Notice */}
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
          <p>
            Your electronic signature has the same legal effect as a handwritten
            signature. Please review all documents carefully before signing.
          </p>
        </div>
      </div>

      {/* Signature Modal using reusable ESignature */}
      <ESignature
        mode="modal"
        isOpen={showSignatureModal}
        onClose={() => {
          setShowSignatureModal(false);
          setActiveDocId(null);
        }}
        onSave={handleSignatureSave}
        title="Draw Your Signature"
      />

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleComplete}
          disabled={!canComplete || isSubmitting}
          className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Finalizing...
            </span>
          ) : (
            'Complete Signing'
          )}
        </button>
      </div>
    </>
  );
}
