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

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { kind: 'tag', value: { tag: '' }, priority: 100 },
    ]);

  const updateRow = (idx: number, next: CoverageRowInput) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? next : r)));

  const removeRow = (idx: number) =>
    setRows((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rows);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="station-master-coverage-editor"
      data-station-master-id={stationMasterId}
    >
      <header>
        <h2>Edit coverage — {stationMasterId}</h2>
        <p>
          Add tags, cities, regions, or property IDs. Priority is sorted
          ascending — lower number wins.
        </p>
      </header>

      <div
        className="map-stub"
        style={{
          height: 220,
          border: '1px dashed #cbd5e0',
          background: '#f7fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#718096',
          margin: '12px 0',
        }}
      >
        Polygon drawing placeholder (googlemaps loader pending)
      </div>

      <table>
        <thead>
          <tr>
            <th>Kind</th>
            <th>Value (JSON)</th>
            <th>Priority</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id ?? `new-${idx}`}>
              <td>
                <select
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
              <td>
                <input
                  type="text"
                  value={JSON.stringify(row.value)}
                  onChange={(e) => {
                    try {
                      updateRow(idx, {
                        ...row,
                        value: JSON.parse(e.target.value),
                      });
                    } catch {
                      // ignore malformed json while typing
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={row.priority}
                  onChange={(e) =>
                    updateRow(idx, {
                      ...row,
                      priority: Number(e.target.value),
                    })
                  }
                />
              </td>
              <td>
                <button type="button" onClick={() => removeRow(idx)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={addRow}>
          Add coverage
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ marginLeft: 8 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default StationMasterCoverageEditor;
