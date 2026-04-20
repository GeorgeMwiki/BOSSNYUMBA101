/**
 * Delegation Matrix page — Wave-13.
 *
 * 5 domains x 6 action-types = 30-cell grid. Each cell shows the current
 * policy rule; clicking opens an inline editor. The master "Autonomous
 * Department Mode" toggle sits at the top with a live stat of actions
 * this week (from autonomous_action_audit).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const DOMAINS = [
  'finance',
  'leasing',
  'maintenance',
  'compliance',
  'communications',
] as const;

const ACTION_TYPES = [
  'auto_send',
  'auto_approve',
  'threshold',
  'escalation',
  'review_window',
  'disabled',
] as const;

type Domain = (typeof DOMAINS)[number];
type ActionType = (typeof ACTION_TYPES)[number];

interface CellState {
  readonly domain: Domain;
  readonly actionType: ActionType;
  readonly enabled: boolean;
  readonly threshold: number | null;
}

function defaultCells(): readonly CellState[] {
  const cells: CellState[] = [];
  for (const domain of DOMAINS) {
    for (const actionType of ACTION_TYPES) {
      cells.push({
        domain,
        actionType,
        enabled: actionType !== 'disabled',
        threshold: actionType === 'threshold' ? 100_000 : null,
      });
    }
  }
  return cells;
}

export default function DelegationMatrix(): JSX.Element {
  const t = useTranslations('delegation');
  const [cells, setCells] = useState<readonly CellState[]>(defaultCells());
  const [autonomousOn, setAutonomousOn] = useState(false);
  const [actionsThisWeek, setActionsThisWeek] = useState<number>(0);
  const [editing, setEditing] = useState<CellState | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ actionsThisWeek: number }>('/audit/autonomous-actions/stats')
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) setActionsThisWeek(res.data.actionsThisWeek);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const grid = useMemo(() => groupByDomain(cells), [cells]);

  function updateCell(next: CellState): void {
    setCells((prev) =>
      prev.map((c) =>
        c.domain === next.domain && c.actionType === next.actionType ? next : c,
      ),
    );
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
      </header>

      <section className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <div>
            <h3 className="font-semibold text-gray-900">{t('masterToggleLabel')}</h3>
            <p className="text-sm text-gray-500">
              {t('actionsThisWeek', { count: actionsThisWeek })}
            </p>
          </div>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={autonomousOn}
            onChange={(e) => setAutonomousOn(e.target.checked)}
            aria-label={t('masterToggleLabel')}
          />
          <span
            className={`w-12 h-6 flex items-center rounded-full p-1 transition ${
              autonomousOn ? 'bg-violet-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`bg-white w-4 h-4 rounded-full shadow transform transition ${
                autonomousOn ? 'translate-x-6' : ''
              }`}
            />
          </span>
        </label>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600">
                {t('gridDomainHeader')}
              </th>
              {ACTION_TYPES.map((a) => (
                <th
                  key={a}
                  className="text-center px-3 py-2 font-medium text-gray-600"
                >
                  {t(`actionType.${a}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((domain) => (
              <tr key={domain} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-700">
                  {t(`domain.${domain}`)}
                </td>
                {ACTION_TYPES.map((actionType) => {
                  const cell = grid[domain][actionType];
                  return (
                    <td key={actionType} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setEditing(cell)}
                        aria-label={`${domain} ${actionType}`}
                        data-testid={`cell-${domain}-${actionType}`}
                        className={`w-full rounded border px-2 py-1 text-xs transition ${
                          cell.enabled
                            ? 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {cell.enabled
                          ? cell.threshold !== null
                            ? `\u2264 ${cell.threshold.toLocaleString()}`
                            : t('status.on')
                          : t('status.off')}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editing && (
        <section
          role="dialog"
          aria-labelledby="cell-editor-title"
          className="bg-violet-50 border border-violet-200 rounded-xl p-5 space-y-3"
        >
          <h3 id="cell-editor-title" className="font-semibold text-violet-900">
            {t('editorTitle', {
              domain: t(`domain.${editing.domain}`),
              action: t(`actionType.${editing.actionType}`),
            })}
          </h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.enabled}
              onChange={(e) =>
                setEditing({ ...editing, enabled: e.target.checked })
              }
            />
            {t('editorEnabledLabel')}
          </label>
          {editing.actionType === 'threshold' && (
            <label className="block text-sm">
              <span className="text-gray-700">{t('editorThresholdLabel')}</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={editing.threshold ?? 0}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    threshold: Number(e.target.value),
                  })
                }
              />
            </label>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateCell(editing)}
              className="rounded bg-violet-600 text-white px-4 py-2 text-sm"
            >
              {t('editorSave')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded border border-gray-300 px-4 py-2 text-sm"
            >
              {t('editorCancel')}
            </button>
          </div>
        </section>
      )}

      {!autonomousOn && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4" />
          <span>{t('warnOff')}</span>
        </div>
      )}
    </div>
  );
}

function groupByDomain(
  cells: readonly CellState[],
): Record<Domain, Record<ActionType, CellState>> {
  const out = {} as Record<Domain, Record<ActionType, CellState>>;
  for (const domain of DOMAINS) {
    out[domain] = {} as Record<ActionType, CellState>;
  }
  for (const cell of cells) {
    out[cell.domain][cell.actionType] = cell;
  }
  return out;
}
