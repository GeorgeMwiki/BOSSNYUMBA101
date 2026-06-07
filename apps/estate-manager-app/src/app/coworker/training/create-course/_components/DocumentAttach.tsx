'use client';

/**
 * DocumentAttach — step 3 (optional) of the coworker create-course flow.
 *
 * Lets the learner list documents from their own portfolio (a lease, a rent
 * roll, an inspection report) so the generated course can be grounded in that
 * real context. This is a metadata-only attach: name + type + a short note the
 * model uses as grounding. It does NOT pretend to extract a file it cannot
 * read (honest-degrade) — a richer upload + OCR pipeline is a separate concern.
 *
 * The step is fully skippable: "Generate without documents" continues with an
 * empty document list.
 *
 * Ported in spirit from LitFin's DocumentUploadZone, simplified to the grounding
 * metadata BN's generator actually consumes.
 */

import { useState } from 'react';
import { ArrowLeft, Plus, Sparkles, Trash2, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Language = 'en' | 'sw';

export interface AttachedDocument {
  readonly documentId: string;
  readonly documentName: string;
  readonly documentType: string;
  readonly summary: string;
}

interface DocumentAttachProps {
  readonly language: Language;
  readonly onBack: () => void;
  readonly onContinue: (documents: ReadonlyArray<AttachedDocument>) => void;
}

const MAX_DOCS = 10;

export function DocumentAttach({
  language,
  onBack,
  onContinue,
}: DocumentAttachProps): JSX.Element {
  void language;
  const t = useTranslations('createCourse');
  const [docs, setDocs] = useState<ReadonlyArray<AttachedDocument>>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [summary, setSummary] = useState('');

  const canAdd = name.trim().length > 0 && docs.length < MAX_DOCS;

  function addDoc(): void {
    if (!canAdd) return;
    const next: AttachedDocument = {
      documentId: `doc-${crypto.randomUUID().slice(0, 8)}`,
      documentName: name.trim(),
      documentType: type.trim(),
      summary: summary.trim(),
    };
    setDocs((prev) => [...prev, next]);
    setName('');
    setType('');
    setSummary('');
  }

  function removeDoc(id: string): void {
    setDocs((prev) => prev.filter((d) => d.documentId !== id));
  }

  return (
    <section
      aria-labelledby="documents-step-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5"
    >
      <div>
        <h2 id="documents-step-heading" className="text-lg font-semibold text-gray-900">
          {t('documentsHeading')}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t('documentsSubheading')}</p>
      </div>

      {docs.length > 0 && (
        <ul className="space-y-2" role="list">
          {docs.map((d) => (
            <li
              key={d.documentId}
              className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {d.documentName}
                  {d.documentType ? (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      {d.documentType}
                    </span>
                  ) : null}
                </p>
                {d.summary ? (
                  <p className="mt-0.5 text-xs text-gray-600">{d.summary}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => removeDoc(d.documentId)}
                aria-label={t('documentRemove')}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-danger-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {docs.length < MAX_DOCS && (
        <div className="space-y-2 rounded-xl border border-dashed border-gray-300 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('documentNamePlaceholder')}
              maxLength={300}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={t('documentTypePlaceholder')}
              maxLength={200}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t('documentSummaryPlaceholder')}
            rows={2}
            maxLength={4_000}
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={addDoc}
            disabled={!canAdd}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t('documentAdd')}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>
        <button
          type="button"
          onClick={() => onContinue(docs)}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          <Sparkles className="h-4 w-4" />
          {docs.length > 0 ? t('generateWithDocuments') : t('generateWithoutDocuments')}
        </button>
      </div>
    </section>
  );
}
