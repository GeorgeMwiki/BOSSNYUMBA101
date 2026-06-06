/**
 * Maintenance triage page — Phase D D10 (Sub-feature 5 of 6).
 *
 * Conversational diagnostic UI for resident-reported issues. The brain
 * lives in `@bossnyumba/central-intelligence` —
 * `src/maintenance-triage/triage-agent.ts`. This page hosts a minimal
 * self-contained mirror of the default tree so the screen works
 * without an extra workspace dep; on dispatch we POST the synthesised
 * work-order to `/api/v1/cases`.
 *
 * Flow:
 *   1. Resident describes the issue in free text.
 *   2. Agent walks the diagnostic tree (one question at a time).
 *   3. Outcome is either:
 *      - SELF-SERVICE: a panel of safety + step-by-step instructions
 *        with a "did this fix it?" CTA. If "yes", session closes; if
 *        "no", escalates to dispatch fall-through.
 *      - DISPATCH: a confirmation panel summarising the classification
 *        + urgency + ETA, with a "submit work-order" button.
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { getApiBaseUrl } from '@/lib/api';
import { getAccessToken } from '@/lib/supabase';
import { getCsrfHeaders } from '@/lib/csrf';

// ─────────────────────────────────────────────────────────────────────
// Local mirror of the triage tree (kept in sync with
// packages/central-intelligence/src/maintenance-triage/triage-agent.ts)
// ─────────────────────────────────────────────────────────────────────

type Urgency = 'low' | 'medium' | 'high' | 'critical' | 'emergency';

type Node =
  | {
      kind: 'question';
      id: string;
      question: string;
      options: ReadonlyArray<{ key: string; labelKey: string; nextNodeId: string }>;
    }
  | {
      kind: 'self-service';
      id: string;
      problemCode: string;
      instructions: ReadonlyArray<string>;
      safetyWarning?: string;
    }
  | {
      kind: 'dispatch';
      id: string;
      problemCode: string;
      urgency: Urgency;
      suggestedPartsList: ReadonlyArray<string>;
      vendorTags: ReadonlyArray<string>;
      residentSummary: string;
    };

const TREE: { rootNodeId: string; nodes: Record<string, Node> } = {
  rootNodeId: 'root',
  nodes: {
    root: {
      kind: 'question',
      id: 'root',
      question: 'What kind of problem are you experiencing?',
      options: [
        { key: 'electrical', labelKey: 'noPowerElectrical', nextNodeId: 'electrical.scope' },
        { key: 'plumbing', labelKey: 'waterPlumbing', nextNodeId: 'plumbing.scope' },
        { key: 'hvac', labelKey: 'acHeatingNotWorking', nextNodeId: 'hvac.scope' },
        { key: 'appliance', labelKey: 'applianceBroken', nextNodeId: 'appliance.dispatch' },
        { key: 'other', labelKey: 'somethingElse', nextNodeId: 'other.dispatch' },
      ],
    },
    'electrical.scope': {
      kind: 'question',
      id: 'electrical.scope',
      question: 'Where is the power out?',
      options: [
        { key: 'whole-house', labelKey: 'wholeHouse', nextNodeId: 'electrical.whole-house.dispatch' },
        { key: 'zone', labelKey: 'oneRoomZone', nextNodeId: 'electrical.zone.breaker-check' },
        { key: 'one-outlet', labelKey: 'oneOutlet', nextNodeId: 'electrical.outlet.dispatch' },
      ],
    },
    'electrical.zone.breaker-check': {
      kind: 'question',
      id: 'electrical.zone.breaker-check',
      question: 'Please check the breaker box. Has a breaker flipped down or shows red?',
      options: [
        { key: 'yes', labelKey: 'breakerFlipped', nextNodeId: 'electrical.breaker.flip-back' },
        { key: 'no', labelKey: 'breakersNormal', nextNodeId: 'electrical.zone.dispatch' },
        { key: 'cant-find', labelKey: 'breakerNotFound', nextNodeId: 'electrical.zone.dispatch' },
      ],
    },
    'electrical.breaker.flip-back': {
      kind: 'self-service',
      id: 'electrical.breaker.flip-back',
      problemCode: 'electrical.breaker.tripped',
      instructions: [
        'Make sure your hands are dry.',
        'At the breaker, push the flipped switch FULLY down (off), then FULLY up (on).',
        'If the switch refuses to stay up, or trips again within a minute, do NOT keep retrying — request a dispatch.',
        'Test by turning on a light in the affected zone.',
      ],
      safetyWarning: 'Never open the breaker box panel itself. Only flip the switch.',
    },
    'electrical.zone.dispatch': {
      kind: 'dispatch',
      id: 'electrical.zone.dispatch',
      problemCode: 'electrical.no-power-zone',
      urgency: 'high',
      suggestedPartsList: ['RCD module', 'wire connectors', 'voltage tester'],
      vendorTags: ['electrician', 'certified'],
      residentSummary:
        'A licensed electrician will be dispatched within 4 hours. Please avoid using any affected switches until they arrive.',
    },
    'electrical.whole-house.dispatch': {
      kind: 'dispatch',
      id: 'electrical.whole-house.dispatch',
      problemCode: 'electrical.no-power-whole',
      urgency: 'critical',
      suggestedPartsList: ['main-breaker assembly', 'meter-side tester'],
      vendorTags: ['electrician', 'utility-liaison'],
      residentSummary:
        'Whole-house outages need same-day response. We are also checking with the utility provider.',
    },
    'electrical.outlet.dispatch': {
      kind: 'dispatch',
      id: 'electrical.outlet.dispatch',
      problemCode: 'electrical.dead-outlet',
      urgency: 'medium',
      suggestedPartsList: ['replacement socket', 'face-plate'],
      vendorTags: ['electrician'],
      residentSummary:
        'A technician will swap the socket within 24 hours. Please avoid plugging anything into that outlet.',
    },
    'plumbing.scope': {
      kind: 'question',
      id: 'plumbing.scope',
      question: 'What is wrong with the water?',
      options: [
        { key: 'leak', labelKey: 'leakOnFloor', nextNodeId: 'plumbing.leak.dispatch' },
        { key: 'no-water', labelKey: 'noWater', nextNodeId: 'plumbing.no-water.dispatch' },
        { key: 'slow-drain', labelKey: 'sinkSlow', nextNodeId: 'plumbing.slow-drain.self' },
      ],
    },
    'plumbing.slow-drain.self': {
      kind: 'self-service',
      id: 'plumbing.slow-drain.self',
      problemCode: 'plumbing.slow-drain',
      instructions: [
        'Remove the drain strainer/cover. Most pop off by hand.',
        'Pull out any visible hair or debris with a hooked tool or gloved fingers.',
        'Run hot water for 30 seconds.',
        'If still slow, request a dispatch — we will send a plumber with a drain snake.',
      ],
    },
    'plumbing.leak.dispatch': {
      kind: 'dispatch',
      id: 'plumbing.leak.dispatch',
      problemCode: 'plumbing.leak',
      urgency: 'critical',
      suggestedPartsList: ['shut-off valve', 'pipe-thread tape', 'compression fittings'],
      vendorTags: ['plumber', 'emergency'],
      residentSummary:
        'Please locate the main water shut-off and turn it off if the leak is large. A plumber is being dispatched now.',
    },
    'plumbing.no-water.dispatch': {
      kind: 'dispatch',
      id: 'plumbing.no-water.dispatch',
      problemCode: 'plumbing.no-water',
      urgency: 'high',
      suggestedPartsList: ['tank-pump replacement', 'pressure-switch'],
      vendorTags: ['plumber'],
      residentSummary:
        'Could be the storage tank or building supply. We are also checking with the building manager.',
    },
    'hvac.scope': {
      kind: 'question',
      id: 'hvac.scope',
      question: 'Is the AC unit running at all (any sound or air movement)?',
      options: [
        { key: 'not-running', labelKey: 'completelyDead', nextNodeId: 'hvac.not-running.remote-check' },
        { key: 'running-no-cool', labelKey: 'runningButWarm', nextNodeId: 'hvac.warm.dispatch' },
        { key: 'noisy', labelKey: 'strangeNoises', nextNodeId: 'hvac.noisy.dispatch' },
      ],
    },
    'hvac.not-running.remote-check': {
      kind: 'question',
      id: 'hvac.not-running.remote-check',
      question: 'When you press the AC remote, does the display light up?',
      options: [
        { key: 'no-display', labelKey: 'remoteBlank', nextNodeId: 'hvac.remote-battery.self' },
        { key: 'display-ok', labelKey: 'remoteIgnored', nextNodeId: 'hvac.warm.dispatch' },
      ],
    },
    'hvac.remote-battery.self': {
      kind: 'self-service',
      id: 'hvac.remote-battery.self',
      problemCode: 'hvac.remote-battery-dead',
      instructions: [
        'Open the back of the AC remote — slide the cover down.',
        'Replace the two AAA batteries.',
        'Point the remote at the AC unit and press the power button. The unit should beep.',
      ],
    },
    'hvac.warm.dispatch': {
      kind: 'dispatch',
      id: 'hvac.warm.dispatch',
      problemCode: 'hvac.no-cooling',
      urgency: 'medium',
      suggestedPartsList: ['35µF capacitor', 'refrigerant top-up', 'gas leak detector'],
      vendorTags: ['hvac', 'refrigerant-certified'],
      residentSummary:
        'A licensed HVAC technician will visit within 24-48 hours. They will check the capacitor and refrigerant level.',
    },
    'hvac.noisy.dispatch': {
      kind: 'dispatch',
      id: 'hvac.noisy.dispatch',
      problemCode: 'hvac.noise',
      urgency: 'low',
      suggestedPartsList: ['fan-motor bearings', 'mounting screws'],
      vendorTags: ['hvac'],
      residentSummary: 'A technician will inspect within 48 hours.',
    },
    'appliance.dispatch': {
      kind: 'dispatch',
      id: 'appliance.dispatch',
      problemCode: 'appliance.general',
      urgency: 'low',
      suggestedPartsList: [],
      vendorTags: ['appliance-tech'],
      residentSummary: 'An appliance technician will visit within 3 working days.',
    },
    'other.dispatch': {
      kind: 'dispatch',
      id: 'other.dispatch',
      problemCode: 'general.uncategorised',
      urgency: 'low',
      suggestedPartsList: [],
      vendorTags: ['general'],
      residentSummary: 'A general technician will reach out to clarify and schedule.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────────────────────────────

// `apiBase` hoisted into `@/lib/api`'s `getApiBaseUrl()` — single helper
// that throws in production when `NEXT_PUBLIC_API_URL` is unset rather than
// silently falling back to localhost. Was duplicated across 4 pages
// (CRITICAL in `.audit/production-readiness-gaps.md`).
const apiBase = getApiBaseUrl;

interface Turn {
  readonly nodeId: string;
  readonly question: string;
  readonly chosenLabel: string;
}

export default function MaintenanceTriagePage() {
  const t = useTranslations('pageHeaders');
  const tTriage = useTranslations('p89.triage');
  const [initialReport, setInitialReport] = useState('');
  const [started, setStarted] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState(TREE.rootNodeId);
  const [history, setHistory] = useState<readonly Turn[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentNode = useMemo(() => TREE.nodes[currentNodeId], [currentNodeId]);

  const choose = useCallback(
    (optionKey: string) => {
      const node = TREE.nodes[currentNodeId];
      if (!node || node.kind !== 'question') return;
      const option = node.options.find((o) => o.key === optionKey);
      if (!option) return;
      setHistory((prev) => [
        ...prev,
        { nodeId: node.id, question: node.question, chosenLabel: tTriage(option.labelKey) },
      ]);
      setCurrentNodeId(option.nextNodeId);
    },
    [currentNodeId, tTriage],
  );

  const reset = useCallback(() => {
    setStarted(false);
    setInitialReport('');
    setCurrentNodeId(TREE.rootNodeId);
    setHistory([]);
    setSubmitted(null);
    setError(null);
  }, []);

  async function dispatchWorkOrder(): Promise<void> {
    const node = currentNode;
    if (!node || node.kind !== 'dispatch') return;
    setSubmitting(true);
    setError(null);
    try {
      const token = (await getAccessToken()) ?? '';
      const description = [
        `Initial report: ${initialReport}`,
        '',
        'Diagnostic transcript:',
        ...history.map((h) => `Q: ${h.question}\nA: ${h.chosenLabel}`),
        '',
        node.residentSummary,
      ].join('\n');
      const res = await fetch(`${apiBase()}/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          title: `${node.problemCode} (triage)`,
          description,
          category: node.problemCode.split('.')[0] ?? 'general',
          severity: node.urgency,
          triageProblemCode: node.problemCode,
          triagePartsList: node.suggestedPartsList,
          triageVendorTags: node.vendorTags,
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        data?: { id?: string };
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Dispatch failed');
      }
      setSubmitted(body.data?.id ?? 'dispatched');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title={t('maintenance')} showBack />
      <div className="px-4 py-4 pb-24 space-y-4">
        {!started && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Describe your issue in a few words and we will walk you through
              a quick diagnostic. Many problems can be fixed in under a
              minute without a technician visit.
            </p>
            <label className="block text-sm text-gray-300">
              What is happening?
              <textarea
                value={initialReport}
                onChange={(e) => setInitialReport(e.target.value)}
                rows={3}
                placeholder="e.g. no power in bedroom; kitchen sink draining slowly; AC blowing warm air"
                className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => setStarted(true)}
              disabled={!initialReport.trim()}
              className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium disabled:opacity-50"
            >
              Start diagnostic
            </button>
          </div>
        )}

        {started && currentNode?.kind === 'question' && (
          <div className="space-y-3">
            <p className="text-base font-medium text-white">{currentNode.question}</p>
            <div className="space-y-2">
              {currentNode.options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => choose(opt.key)}
                  className="w-full text-left rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white hover:bg-gray-700"
                >
                  {tTriage(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {started && currentNode?.kind === 'self-service' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-100 p-3">
              <p className="text-sm font-medium">{tTriage('diyAdvice')}</p>
            </div>
            {currentNode.safetyWarning && (
              <div className="rounded-lg bg-amber-900/30 border border-amber-500/40 text-amber-200 p-3 text-sm">
                Safety: {currentNode.safetyWarning}
              </div>
            )}
            <ol className="space-y-2 list-decimal list-inside text-sm text-gray-200">
              {currentNode.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg bg-emerald-700 text-white py-3 font-medium"
              >
                It worked — close
              </button>
              <button
                type="button"
                onClick={() => setCurrentNodeId('other.dispatch')}
                className="rounded-lg bg-gray-700 text-white py-3 font-medium"
              >
                Did not work — dispatch
              </button>
            </div>
          </div>
        )}

        {started && currentNode?.kind === 'dispatch' && !submitted && (
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-900/30 border border-blue-500/40 text-blue-100 p-3 space-y-1">
              <p className="text-sm font-medium">{tTriage('dispatchTechnician')}</p>
              <p className="text-xs text-blue-200">
                Classification: {currentNode.problemCode} · urgency {currentNode.urgency}
              </p>
            </div>
            <p className="text-sm text-gray-300">{currentNode.residentSummary}</p>
            {currentNode.suggestedPartsList.length > 0 && (
              <div className="text-xs text-gray-400">
                Pre-ordered parts: {currentNode.suggestedPartsList.join(', ')}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={() => void dispatchWorkOrder()}
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium disabled:opacity-50"
            >
              {submitting ? 'Dispatching…' : 'Submit work-order'}
            </button>
          </div>
        )}

        {submitted && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-100 p-3">
              <p className="text-sm font-medium">Work-order submitted.</p>
              <p className="text-xs text-emerald-200">Reference: {submitted}</p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-lg bg-gray-700 text-white py-3 font-medium"
            >
              Start another
            </button>
          </div>
        )}

        {history.length > 0 && (
          <details className="text-xs text-gray-500 mt-4">
            <summary>{tTriage('diagnosticHistory')}</summary>
            <ul className="mt-2 space-y-1">
              {history.map((h, i) => (
                <li key={i}>
                  <span className="text-gray-400">{h.question}</span> →{' '}
                  <span className="text-gray-200">{h.chosenLabel}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}
