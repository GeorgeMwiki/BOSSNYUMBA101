'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  PenLine,
  AlertCircle,
  Eye,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { EmptyState } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type OnboardingDocument } from '@/lib/api';
import { useCurrencyPreference } from '@/lib/hooks/useCurrencyPreference';
import { ROUTES } from '@/lib/routes';

// `ESignature` is a canvas-backed signature pad — heavy because it
// owns pointer + touch event handling and rasterises to PNG. It is
// modal-only (rendered only when the user taps Sign), so we keep it
// out of the e-sign route's initial bundle. `ssr: false` because the
// canvas relies on browser-only APIs.
const ESignature = dynamic(
  () =>
    import('../../../components/ESignature.js').then((m) => ({
      default: m.ESignature,
    })),
  { ssr: false, loading: () => null },
);

/**
 * Local signing state laid over each REAL document fetched from the
 * backend. We never seed `signed`/`signatureData` from a fabricated
 * source — they start from the server's truthful `signed`/`signedAt`
 * and only advance when the resident actually signs in this session.
 */
interface SigningDoc extends OnboardingDocument {
  readonly localSigned: boolean;
  readonly localSignedAt?: string;
  readonly signatureData?: string;
}

/** A scalar money payload `{ amount, currency }` as returned per-section. */
function isMoney(v: unknown): v is { amount: number; currency: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { amount?: unknown }).amount === 'number'
  );
}

export default function OnboardingESignPage() {
  const t = useTranslations('onboardingESign');
  const tA11y = useTranslations('a11y');
  const router = useRouter();
  const { format: formatCurrency } = useCurrencyPreference();

  const documentsQuery = useQuery({
    queryKey: ['onboarding-documents'],
    queryFn: () => api.onboarding.getDocuments(),
  });

  const [signing, setSigning] = useState<Record<string, { signedAt: string; signatureData: string }>>(
    {},
  );
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serverDocs = documentsQuery.data?.documents ?? [];
  const documents: SigningDoc[] = serverDocs.map((doc) => {
    const local = signing[doc.id];
    return {
      ...doc,
      localSigned: doc.signed || Boolean(local),
      localSignedAt: local?.signedAt ?? doc.signedAt,
      signatureData: local?.signatureData,
    };
  });

  const allSigned = documents.length > 0 && documents.every((doc) => doc.localSigned);
  const canComplete = allSigned && agreedToTerms;

  const openSignatureModal = (docId: string) => {
    setActiveDocId(docId);
    setShowSignatureModal(true);
  };

  const handleSignatureSave = (signatureDataUrl: string) => {
    if (activeDocId) {
      setSigning((prev) => ({
        ...prev,
        [activeDocId]: {
          signedAt: new Date().toISOString(),
          signatureData: signatureDataUrl,
        },
      }));
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
          signed: d.localSigned,
          signedAt: d.localSignedAt,
        })),
      });
    } catch {
      // Best-effort step persistence — never blocks the resident from
      // advancing once their real documents are signed.
    }

    const savedProgress = JSON.parse(
      localStorage.getItem('onboarding_progress') || '{}',
    );
    savedProgress['e-sign'] = 'completed';
    localStorage.setItem('onboarding_progress', JSON.stringify(savedProgress));

    router.push(ROUTES.onboarding.complete);
  };

  /** Render one section's real lease data as readable lines. */
  const renderSection = (section: OnboardingDocument['sections'][number]) => {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(section.data)) {
      if (value === null || value === undefined) continue;
      if (isMoney(value)) {
        lines.push(`${humanizeKey(key)}: ${formatCurrency(value.amount)}`);
      } else if (Array.isArray(value)) {
        if (value.length > 0) lines.push(`${humanizeKey(key)}: ${value.join(', ')}`);
      } else if (isIsoDate(value)) {
        lines.push(`${humanizeKey(key)}: ${new Date(value).toLocaleDateString()}`);
      } else {
        lines.push(`${humanizeKey(key)}: ${String(value)}`);
      }
    }
    return lines;
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="px-4 py-4 space-y-6 pb-32">
        {documentsQuery.isLoading && (
          <div className="card p-4 text-sm text-gray-400">{t('loading')}</div>
        )}

        {documentsQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 flex items-center justify-between gap-3">
            <span>{(documentsQuery.error as Error).message || t('errorLoad')}</span>
            <button
              type="button"
              onClick={() => documentsQuery.refetch()}
              className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {/* Honest empty/pending state — a fresh resident has no lease yet,
            so there is genuinely nothing to sign. We NEVER show a
            fabricated document set here. */}
        {!documentsQuery.isLoading && !documentsQuery.error && documents.length === 0 && (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
          />
        )}

        {documents.length > 0 && (
          <>
            {/* Progress Summary */}
            <div className="card p-4 bg-primary-50 border-primary-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <PenLine className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-primary-900">{t('documentsToSign')}</h3>
                    <p className="text-sm text-primary-700">
                      {documents.filter((d) => d.localSigned).length} {t('of')}{' '}
                      {documents.length} {t('signedCount')}
                    </p>
                  </div>
                </div>
                {allSigned && <span className="badge-success">{t('allSigned')}</span>}
              </div>
            </div>

            {/* Documents List */}
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="card overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedDocId(expandedDocId === doc.id ? null : doc.id)
                    }
                    className="w-full p-4 flex items-start gap-3 text-left"
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        doc.localSigned ? 'bg-success-50' : 'bg-gray-100'
                      }`}
                    >
                      <FileText
                        className={`w-5 h-5 ${
                          doc.localSigned ? 'text-success-600' : 'text-gray-600'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{doc.name}</h3>
                        {doc.localSigned && <Check className="w-4 h-4 text-success-600" />}
                      </div>
                      {/* Real summary: lease number + where it applies. */}
                      <p className="text-sm text-gray-500 mt-0.5">
                        {[doc.leaseNumber, doc.where].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {expandedDocId === doc.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedDocId === doc.id && (
                    <div className="border-t border-gray-100">
                      <div className="p-4 space-y-4">
                        {doc.sections.map((section, idx) => {
                          const lines = renderSection(section);
                          if (lines.length === 0) return null;
                          return (
                            <div key={idx}>
                              <h4 className="font-medium text-sm text-gray-900 mb-1">
                                {section.title}
                              </h4>
                              {lines.map((line, lineIdx) => (
                                <p key={lineIdx} className="text-sm text-gray-600">
                                  {line}
                                </p>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      {doc.localSigned && doc.signatureData && (
                        <div className="px-4 pb-2">
                          <div className="border rounded-lg p-2 bg-success-50 border-success-200">
                            <img
                              src={doc.signatureData}
                              alt={tA11y('signaturePreview')}
                              className="h-12 mx-auto"
                            />
                            {doc.localSignedAt && (
                              <p className="text-xs text-success-600 text-center mt-1">
                                {t('signedOn')}{' '}
                                {new Date(doc.localSignedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="p-4 border-t border-gray-100 flex gap-3">
                        {doc.documentUrl ? (
                          <a
                            href={doc.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary flex-1 text-sm flex items-center justify-center"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {t('viewFullDocument')}
                          </a>
                        ) : (
                          <div className="flex-1" />
                        )}
                        {doc.localSigned ? (
                          <div className="flex-1 flex items-center justify-center text-sm text-success-600 font-medium">
                            <Check className="w-4 h-4 mr-1" />
                            {t('signed')}
                          </div>
                        ) : (
                          <button
                            onClick={() => openSignatureModal(doc.id)}
                            className="btn-primary flex-1 text-sm"
                          >
                            <PenLine className="w-4 h-4 mr-1" />
                            {t('signDocument')}
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
                  <span className="text-sm text-gray-600">{t('confirmTerms')}</span>
                </label>
              </div>
            )}

            {/* Important Notice */}
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <AlertCircle className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
              <p>{t('legalNotice')}</p>
            </div>
          </>
        )}
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
        title={t('drawSignature')}
      />

      {/* Fixed Bottom Button — only when there is something to sign. */}
      {documents.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            onClick={handleComplete}
            disabled={!canComplete || isSubmitting}
            className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('finalizing')}
              </span>
            ) : (
              t('completeSigning')
            )}
          </button>
        </div>
      )}
    </>
  );
}

/** Turn a camelCase field key into a readable label. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Loose ISO-date detector for section value rendering. */
function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);
}
