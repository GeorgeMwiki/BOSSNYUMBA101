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
        prev.map((e, i) => (i === idx ? 'Invalid JSON' : e))
      );
    }
  }, []);

  const removeRow = React.useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setJsonDrafts((prev) => prev.filter((_, i) => i !== idx));
    setJsonErrors((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const hasJsonError = jsonErrors.some((e) => e !== null);

  const handleSave = React.useCallback(async () => {
    if (hasJsonError) {
      setSaveError('Fix invalid JSON before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(rows);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save coverage');
    } finally {
      setSaving(false);
    }
  }, [hasJsonError, onSave, rows]);

  return (
    <div
      className="station-master-coverage-editor p-4 space-y-4"
      data-station-master-id={stationMasterId}
    >
      <header>
        <h2 className="text-xl font-semibold">Edit coverage — {stationMasterId}</h2>
        <p className="text-sm text-muted-foreground">
          Add tags, cities, regions, or property IDs. Priority is sorted
          ascending — lower number wins.
        </p>
      </header>

      {saveError && (
        <Alert variant="danger">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      <div
        role="img"
        aria-label="Polygon drawing placeholder"
        className="h-56 flex items-center justify-center border border-dashed border-gray-300 bg-gray-50 text-gray-500 rounded-md"
      >
        Polygon drawing placeholder (googlemaps loader pending)
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No coverage rules yet. Add one to start assigning properties.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="p-2 text-left">Kind</th>
              <th scope="col" className="p-2 text-left">Value (JSON)</th>
              <th scope="col" className="p-2 text-left">Priority</th>
              <th scope="col" className="p-2"><span className="sr-only">Actions</span></th>
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
                      Coverage kind for row {idx + 1}
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
                      <option value="polygon">polygon (pending)</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <label htmlFor={valueId} className="sr-only">
                      Coverage value JSON for row {idx + 1}
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
                      Priority for row {idx + 1}
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
                      aria-label={`Remove coverage row ${idx + 1}`}
                    >
                      Remove
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
          Add coverage
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          loading={saving}
          disabled={saving || hasJsonError}
          title={hasJsonError ? 'Fix invalid JSON to save' : undefined}
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export default StationMasterCoverageEditor;
