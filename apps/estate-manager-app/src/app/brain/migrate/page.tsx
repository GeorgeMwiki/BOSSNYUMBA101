'use client';

/**
 * Migration Wizard — chat-first onboarding.
 *
 * Admin drops a CSV/XLSX/JSON file, the Brain extracts drafts, shows a diff,
 * admin approves, the Brain commits. Phase 1: commit is dry-run (see
 * skill.migration.commit) — real writes ship with the repository hookup.
 */

import { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner } from '@bossnyumba/design-system';

type Step = 'upload' | 'extracting' | 'review' | 'committing' | 'done' | 'error';

interface ExtractBundle {
  properties: unknown[];
  units: unknown[];
  tenants: unknown[];
  employees: unknown[];
  departments: unknown[];
  teams: unknown[];
}

interface DiffResult {
  toAdd: {
    properties: number;
    units: number;
    tenants: number;
    employees: number;
    departments: number;
    teams: number;
  };
  toSkip: number;
  samples: {
    properties: unknown[];
    units: unknown[];
    tenants: unknown[];
    employees: unknown[];
  };
  warnings: string[];
}

export default function MigrationWizardPage() {
  const t = useTranslations('brainMigrate');
  const [step, setStep] = useState<Step>('upload');
  const [bundle, setBundle] = useState<ExtractBundle | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    setStep('extracting');
    try {
      const text = await file.text();
      const sheets = parseFileToSheets(file.name, text);
      const res = await fetch('/api/brain/migrate/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets }),
      });
      if (!res.ok) throw new Error(`extract failed (${res.status})`);
      const data = (await res.json()) as {
        bundle: ExtractBundle;
        diff: DiffResult;
      };
      setBundle(data.bundle);
      setDiff(data.diff);
      setStep('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'extract error');
      setStep('error');
    }
  }, []);

  const handleCommit = useCallback(async () => {
    if (!bundle) return;
    setStep('committing');
    setError(null);
    try {
      const res = await fetch('/api/brain/migrate/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle }),
      });
      if (!res.ok) throw new Error(`commit failed (${res.status})`);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'commit error');
      setStep('error');
    }
  }, [bundle]);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        showBack
      />
      <div className="px-4 py-4 pb-24 max-w-3xl mx-auto flex flex-col gap-4">
        <Stepper step={step} />

        {step === 'upload' && <UploadPanel onFile={handleFile} />}

        {step === 'extracting' && (
          <div className="rounded-xl border border-gray-100 p-6 flex items-center gap-3 bg-white">
            <Spinner className="h-5 w-5 text-sky-500" />
            <div>
              <div className="font-medium">{t('extracting')}</div>
              <div className="text-xs text-gray-500">{fileName}</div>
            </div>
          </div>
        )}

        {step === 'review' && diff && (
          <ReviewPanel
            diff={diff}
            fileName={fileName ?? ''}
            onApprove={handleCommit}
            onCancel={() => {
              setStep('upload');
              setBundle(null);
              setDiff(null);
            }}
          />
        )}

        {step === 'committing' && (
          <div className="rounded-xl border border-gray-100 p-6 flex items-center gap-3 bg-white">
            <Spinner className="h-5 w-5 text-sky-500" />
            <div className="font-medium">{t('committing')}</div>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <div className="font-medium text-green-900">{t('migrationComplete')}</div>
              <p className="text-sm text-green-800 mt-1">
                {t('migrationCompleteDesc')}
              </p>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-medium text-red-900">{t('somethingWrong')}</div>
              <p className="text-sm text-red-800 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="mt-2 text-sm text-red-900 underline"
              >
                {t('tryAgain')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  const t = useTranslations('brainMigrate');
  const stages: Array<{ id: Step | 'upload_base'; label: string }> = [
    { id: 'upload_base', label: t('stepUpload') },
    { id: 'review', label: t('stepReview') },
    { id: 'done', label: t('stepCommit') },
  ];
  const rank: Record<Step, number> = {
    upload: 0,
    extracting: 0,
    review: 1,
    committing: 1,
    done: 2,
    error: 0,
  };
  const current = rank[step];
  return (
    <div className="flex items-center gap-2">
      {stages.map((s, i) => {
        const active = i <= current;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium ${active ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              {i + 1}
            </div>
            <div
              className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
            >
              {s.label}
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="w-4 h-4 text-gray-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadPanel({ onFile }: { onFile: (f: File) => void }) {
  const t = useTranslations('brainMigrate');
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      htmlFor="migration-file"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`block rounded-2xl border-2 border-dashed p-8 bg-white cursor-pointer transition ${
        dragOver ? 'border-sky-500 bg-sky-50' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Upload className="w-8 h-8 text-sky-500" />
        <div className="font-medium">{t('dropOrClick')}</div>
        <div className="text-sm text-gray-500 max-w-md">
          {t('dropHelp')}
        </div>
        <input
          id="migration-file"
          type="file"
          accept=".csv,.json,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>
    </label>
  );
}

function ReviewPanel({
  diff,
  fileName,
  onApprove,
  onCancel,
}: {
  diff: DiffResult;
  fileName: string;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('brainMigrate');
  const total =
    diff.toAdd.properties +
    diff.toAdd.units +
    diff.toAdd.tenants +
    diff.toAdd.employees +
    diff.toAdd.departments +
    diff.toAdd.teams;
  const labelKeys: Record<
    'properties' | 'units' | 'tenants' | 'employees' | 'departments' | 'teams',
    'labelProperties' | 'labelUnits' | 'labelTenants' | 'labelEmployees' | 'labelDepartments' | 'labelTeams'
  > = {
    properties: 'labelProperties',
    units: 'labelUnits',
    tenants: 'labelTenants',
    employees: 'labelEmployees',
    departments: 'labelDepartments',
    teams: 'labelTeams',
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4 flex items-center gap-3">
        <FileText className="w-5 h-5 text-gray-500" />
        <div className="flex-1">
          <div className="text-sm font-medium">{fileName}</div>
          <div className="text-xs text-gray-500">
            {total === 1
              ? t('entityToAdd', { count: total, skip: diff.toSkip })
              : t('entitiesToAdd', { count: total, skip: diff.toSkip })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100">
        {(['properties', 'units', 'tenants', 'employees', 'departments', 'teams'] as const).map(
          (k) => (
            <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{t(labelKeys[k])}</span>
              <span className="font-mono text-gray-900">
                +{diff.toAdd[k]}
              </span>
            </div>
          )
        )}
      </div>

      {diff.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="font-medium text-amber-900 text-sm flex items-center gap-1 mb-1">
            <AlertTriangle className="w-4 h-4" />
            {t('warningsLabel', { count: diff.warnings.length })}
          </div>
          <ul className="text-xs text-amber-900 list-disc pl-5 space-y-0.5">
            {diff.warnings.slice(0, 6).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <SamplePreview diff={diff} />

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="flex-1 rounded-xl bg-sky-500 text-white px-3 py-2 text-sm font-medium hover:bg-sky-600"
        >
          {t('approveCommit')}
        </button>
      </div>
    </div>
  );
}

function SamplePreview({ diff }: { diff: DiffResult }) {
  const t = useTranslations('brainMigrate');
  const labelKeys: Record<
    'properties' | 'units' | 'tenants' | 'employees',
    'labelProperties' | 'labelUnits' | 'labelTenants' | 'labelEmployees'
  > = {
    properties: 'labelProperties',
    units: 'labelUnits',
    tenants: 'labelTenants',
    employees: 'labelEmployees',
  };
  return (
    <details className="rounded-xl border border-gray-100 bg-white p-3">
      <summary className="text-sm font-medium cursor-pointer select-none">
        {t('sampleRows')}
      </summary>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
        {(['properties', 'units', 'tenants', 'employees'] as const).map((k) => (
          <div key={k} className="rounded-lg bg-gray-50 p-2">
            <div className="text-gray-500 mb-1">{t(labelKeys[k])}</div>
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(diff.samples[k], null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// File parsers — CSV / JSON → sheets dict expected by skill.migration.extract
// ---------------------------------------------------------------------------

function parseFileToSheets(
  fileName: string,
  text: string
): Record<string, Array<Record<string, string | number | null>>> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) {
    try {
      const j = JSON.parse(text);
      // Accept either { sheets: {...} } or a flat dict of arrays
      if (j && typeof j === 'object' && 'sheets' in j) {
        return j.sheets as Record<
          string,
          Array<Record<string, string | number | null>>
        >;
      }
      if (Array.isArray(j)) return { data: j };
      if (j && typeof j === 'object') return j;
      return {};
    } catch {
      return {};
    }
  }
  // CSV fallback — name the sheet after the file stem.
  const sheetName = lower.replace(/\.(csv|txt)$/, '') || 'sheet1';
  return { [sheetName]: parseCsv(text) };
}

function parseCsv(
  text: string
): Array<Record<string, string | number | null>> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvRow(lines[0]).map((h) => h.trim());
  const rows: Array<Record<string, string | number | null>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const row: Record<string, string | number | null> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = cols[j]?.trim() ?? '';
      if (!raw) {
        row[headers[j]] = null;
        continue;
      }
      const n = Number(raw.replace(/[,\s]/g, ''));
      row[headers[j]] = Number.isFinite(n) && /^-?[\d,.\s]+$/.test(raw) ? n : raw;
    }
    rows.push(row);
  }
  return rows;
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        buf += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        buf += c;
      }
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') {
        out.push(buf);
        buf = '';
      } else buf += c;
    }
  }
  out.push(buf);
  return out;
}
