/**
 * StationMasterCoverageEditor (NEW 18)
 *
 * Editor skeleton paired with StationMasterCoverageMap (read-only
 * summary). Exposes tabular editing for tag / city / property_ids /
 * region coverages and leaves a polygon placeholder for later.
 *
 * TODO(@googlemaps/js-api-loader + @turf): replace the polygon kind
 * placeholder with an interactive map + polygon drawing tool once the
 * GeoNode hierarchy is operational.
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Alert, AlertDescription } from '@bossnyumba/design-system';

export type CoverageKind =
  | 'tag'
  | 'polygon'
  | 'city'
  | 'property_ids'
  | 'region';

export interface CoverageRowInput {
  readonly id?: string;
  readonly kind: CoverageKind;
  readonly value: Readonly<Record<string, unknown>>;
  readonly priority: number;
}

export interface StationMasterCoverageEditorProps {
  readonly stationMasterId: string;
  readonly initial: readonly CoverageRowInput[];
  readonly onSave: (rows: readonly CoverageRowInput[]) => Promise<void>;
}

export const StationMasterCoverageEditor: React.FC<
  StationMasterCoverageEditorProps
> = (props) => {
  const t = useTranslations('stationMasterCoverage');
  const { stationMasterId, initial, onSave } = props;
  const [rows, setRows] = React.useState<readonly CoverageRowInput[]>(initial);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Track raw JSON input per row so typing doesn't re-serialize and
  // fight the user. Keyed by row index.
  const [jsonDrafts, setJsonDrafts] = React.useState<ReadonlyArray<string>>(
    () => initial.map((r) => JSON.stringify(r.value))
  );
  const [jsonErrors, setJsonErrors] = React.useState<ReadonlyArray<string | null>>(
    () => initial.map(() => null)
  );

  const addRow = React.useCallback(() => {
    setRows((prev) => [
      ...prev,
      { kind: 'tag', value: { tag: '' }, priority: 100 },
    ]);
    setJsonDrafts((prev) => [...prev, JSON.stringify({ tag: '' })]);
    setJsonErrors((prev) => [...prev, null]);
  }, []);

  const updateRow = React.useCallback((idx: number, next: CoverageRowInput) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? next : r)));
  }, []);

  const updateJsonDraft = React.useCallback((idx: number, draft: string) => {
    setJsonDrafts((prev) => prev.map((d, i) => (i === idx ? draft : d)));
    try {
      const parsed = JSON.parse(draft) as Readonly<Record<string, unknown>>;
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, value: parsed } : r))
      );
      setJsonErrors((prev) => prev.map((e, i) => (i === idx ? null : e)));
    } catch {
      setJsonErrors((prev) =>
        prev.map((e, i) => (i === idx ? t('invalidJson') : e))
      );
    }
  }, [t]);

  const removeRow = React.useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setJsonDrafts((prev) => prev.filter((_, i) => i !== idx));
    setJsonErrors((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const hasJsonError = jsonErrors.some((e) => e !== null);

  const handleSave = React.useCallback(async () => {
    if (hasJsonError) {
      setSaveError(t('fixJsonFirst'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(rows);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [hasJsonError, onSave, rows, t]);

  return (
    <div
      className="station-master-coverage-editor p-4 space-y-4"
      data-station-master-id={stationMasterId}
    >
      <header>
        <h2 className="text-xl font-semibold">{t('title', { id: stationMasterId })}</h2>
        <p className="text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </header>

      {saveError && (
        <Alert variant="danger">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div
        role="img"
        aria-label={t('polygonPlaceholderAria')}
        className="h-56 flex items-center justify-center border border-dashed border-gray-300 bg-gray-50 text-gray-500 rounded-md"
      >
        {t('polygonPlaceholder')}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('emptyCoverage')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="p-2 text-left">{t('cols.kind')}</th>
              <th scope="col" className="p-2 text-left">{t('cols.value')}</th>
              <th scope="col" className="p-2 text-left">{t('cols.priority')}</th>
              <th scope="col" className="p-2"><span className="sr-only">{t('cols.actions')}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const kindId = `coverage-kind-${idx}`;
              const valueId = `coverage-value-${idx}`;
              const priorityId = `coverage-priority-${idx}`;
              const jsonError = jsonErrors[idx];
              return (
                <tr key={row.id ?? `new-${idx}`} className="border-b align-top">
                  <td className="p-2">
                    <label htmlFor={kindId} className="sr-only">
                      {t('labels.kind', { row: idx + 1 })}
                    </label>
                    <select
                      id={kindId}
                      className="border rounded-md px-2 py-1 text-sm"
                      value={row.kind}
                      onChange={(e) =>
                        updateRow(idx, {
                          ...row,
                          kind: e.target.value as CoverageKind,
                        })
                      }
                    >
                      <option value="tag">tag</option>
                      <option value="city">city</option>
                      <option value="property_ids">property_ids</option>
                      <option value="region">region</option>
                      <option value="polygon">{t('polygonPending')}</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <label htmlFor={valueId} className="sr-only">
                      {t('labels.value', { row: idx + 1 })}
                    </label>
                    <Input
                      id={valueId}
                      type="text"
                      value={jsonDrafts[idx] ?? ''}
                      onChange={(e) => updateJsonDraft(idx, e.target.value)}
                      aria-invalid={jsonError !== null}
                      aria-describedby={jsonError ? `${valueId}-err` : undefined}
                    />
                    {jsonError && (
                      <p id={`${valueId}-err`} className="text-xs text-red-600 mt-1">
                        {jsonError}
                      </p>
                    )}
                  </td>
                  <td className="p-2">
                    <label htmlFor={priorityId} className="sr-only">
                      {t('labels.priority', { row: idx + 1 })}
                    </label>
                    <Input
                      id={priorityId}
                      type="number"
                      min={0}
                      value={row.priority}
                      onChange={(e) =>
                        updateRow(idx, {
                          ...row,
                          priority: Number(e.target.value),
                        })
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="p-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeRow(idx)}
                      aria-label={t('removeAria', { row: idx + 1 })}
                    >
                      {t('remove')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addRow}>
          {t('addCoverage')}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          loading={saving}
          disabled={saving || hasJsonError}
          title={hasJsonError ? t('fixJsonFirst') : undefined}
        >
          {t('save')}
        </Button>
      </div>
    </div>
  );
};

export default StationMasterCoverageEditor;
