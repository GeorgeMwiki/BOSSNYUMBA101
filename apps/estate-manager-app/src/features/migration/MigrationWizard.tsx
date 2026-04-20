/**
 * MigrationWizard UI skeleton — upload → preview → approve → commit.
 *
 * Framework-minimal: React + fetch. Wire to the shared API client and
 * design-system components in the integration step.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type Counts = {
  properties: number;
  units: number;
  tenants: number;
  employees: number;
  departments: number;
  teams: number;
};

type ExtractionBundle = {
  properties: unknown[];
  units: unknown[];
  tenants: unknown[];
  employees: unknown[];
  departments: unknown[];
  teams: unknown[];
};

type UploadResponse = {
  runId: string;
  bundle: ExtractionBundle;
  warnings: string[];
};

type CommitResponse =
  | { ok: true; runId: string; counts: Counts; skipped: Record<string, string[]> }
  | { ok: false; error: { code: string; message: string } };

type Stage = 'idle' | 'uploading' | 'preview' | 'approved' | 'committing' | 'done' | 'error';

const API_BASE = '/api/v1/brain/migration';

function countsOf(bundle: ExtractionBundle): Counts {
  return {
    properties: bundle.properties.length,
    units: bundle.units.length,
    tenants: bundle.tenants.length,
    employees: bundle.employees.length,
    departments: bundle.departments.length,
    teams: bundle.teams.length,
  };
}

export function MigrationWizard(): JSX.Element {
  const t = useTranslations('migrationWizard');
  const [stage, setStage] = useState<Stage>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<ExtractionBundle | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);

  const counts = useMemo(
    () => (bundle ? countsOf(bundle) : null),
    [bundle]
  );

  const handleUpload = useCallback(async (file: File) => {
    setStage('uploading');
    setErrorMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const data = (await res.json()) as UploadResponse;
      setRunId(data.runId);
      setBundle(data.bundle);
      setWarnings(data.warnings ?? []);
      setStage('preview');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }, []);

  const handleApprove = useCallback(() => {
    setStage('approved');
  }, []);

  const handleCommit = useCallback(async () => {
    if (!runId) return;
    setStage('committing');
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE}/${encodeURIComponent(runId)}/commit`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as CommitResponse;
      setCommitResult(data);
      if (data.ok === true) {
        setStage('done');
      } else {
        setStage('error');
        setErrorMessage(data.error.message);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }, [runId]);

  return (
    <section aria-labelledby="mig-heading" style={{ padding: '1rem' }}>
      <h1 id="mig-heading">{t('heading')}</h1>

      {stage === 'idle' || stage === 'error' ? (
        <div>
          <label htmlFor="mig-file">{t('uploadLabel')}</label>
          <input
            id="mig-file"
            type="file"
            accept=".csv,.xlsx,.pdf,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
          {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        </div>
      ) : null}

      {stage === 'uploading' ? <p>{t('parsingUpload')}</p> : null}

      {(stage === 'preview' || stage === 'approved') && counts ? (
        <div>
          <h2>{t('previewHeading', { runId: runId ?? '' })}</h2>
          <ul>
            <li>{t('propertiesLabel', { count: counts.properties })}</li>
            <li>{t('unitsLabel', { count: counts.units })}</li>
            <li>{t('tenantsLabel', { count: counts.tenants })}</li>
            <li>{t('employeesLabel', { count: counts.employees })}</li>
            <li>{t('departmentsLabel', { count: counts.departments })}</li>
            <li>{t('teamsLabel', { count: counts.teams })}</li>
          </ul>
          {warnings.length ? (
            <div>
              <h3>{t('warnings')}</h3>
              <ul>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {stage === 'preview' ? (
            <button onClick={handleApprove}>{t('approve')}</button>
          ) : (
            <button onClick={handleCommit}>{t('commitDatabase')}</button>
          )}
        </div>
      ) : null}

      {stage === 'committing' ? <p>{t('writingDatabase')}</p> : null}

      {stage === 'done' && commitResult && commitResult.ok ? (
        <div>
          <h2>{t('committed')}</h2>
          <p>
            {t('committedText', {
              runId: commitResult.runId,
              entities: Object.values(commitResult.counts).reduce((s, n) => s + n, 0),
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default MigrationWizard;
