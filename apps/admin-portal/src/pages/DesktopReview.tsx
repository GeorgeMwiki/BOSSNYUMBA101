/**
 * Desktop Review — multi-panel admin surface (Wave-12 port of LitFin's
 * desktop-review page, translated to estate-ops).
 *
 * Four panels, each with quick-action buttons (approve / delegate /
 * escalate / ask Mr. Mwikila). Clicking a quick-action opens manager-chat
 * with pre-filled context.
 *
 * Auto-refresh every 30s. i18n EN + SW.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dopamine } from '@bossnyumba/chat-ui';

const { ConfettiTrigger } = Dopamine;

type Language = 'en' | 'sw';

type QuickAction = 'approve' | 'delegate' | 'escalate' | 'ask';

interface ArrearsItem {
  readonly id: string;
  readonly tenantName: string;
  readonly unit: string;
  readonly amountDue: number;
  readonly currency: string;
  readonly daysLate: number;
  readonly ladderStep: string;
}

interface MaintenanceItem {
  readonly id: string;
  readonly property: string;
  readonly unit: string;
  readonly category: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly openedAt: string;
}

interface ApprovalItem {
  readonly id: string;
  readonly kind: 'tender-award' | 'rent-repricing' | 'vendor-onboarding' | 'lease-renewal';
  readonly summary: string;
  readonly requester: string;
  readonly waitingSinceHours: number;
}

interface InsightItem {
  readonly id: string;
  readonly kind: string;
  readonly severity: 'info' | 'warn' | 'critical';
  readonly title: string;
  readonly description: string;
}

interface PanelData {
  readonly arrears: readonly ArrearsItem[];
  readonly maintenance: readonly MaintenanceItem[];
  readonly approvals: readonly ApprovalItem[];
  readonly insights: readonly InsightItem[];
}

const LABELS: Record<Language, Record<string, string>> = {
  en: {
    title: 'Desktop Review',
    subtitle: 'Four queues, one screen. Triage faster with Mr. Mwikila.',
    arrearsTitle: 'Open arrears',
    maintenanceTitle: 'Maintenance triage',
    approvalsTitle: 'Pending approvals',
    insightsTitle: "Today's proactive insights",
    approve: 'Approve',
    delegate: 'Delegate',
    escalate: 'Escalate',
    ask: 'Ask Mr. Mwikila',
    refresh: 'Refresh',
    empty: 'Nothing pending.',
    updated: 'Updated',
  },
  sw: {
    title: 'Ukaguzi wa Dawati',
    subtitle: 'Foleni nne, skrini moja. Harakisha na Mr. Mwikila.',
    arrearsTitle: 'Deni wazi',
    maintenanceTitle: 'Triage ya matengenezo',
    approvalsTitle: 'Idhini zinazosubiri',
    insightsTitle: 'Maarifa ya leo',
    approve: 'Idhinisha',
    delegate: 'Kabidhi',
    escalate: 'Panua',
    ask: 'Uliza Mr. Mwikila',
    refresh: 'Sasisha',
    empty: 'Hakuna linalosubiri.',
    updated: 'Imesasishwa',
  },
};

function fetchPanelData(): Promise<PanelData> {
  return Promise.resolve<PanelData>({
    arrears: [],
    maintenance: [],
    approvals: [],
    insights: [],
  });
}

function detectInitialLanguage(): Language {
  if (typeof document === 'undefined') return 'en';
  const cookie = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('NEXT_LOCALE='));
  return cookie?.endsWith('sw') ? 'sw' : 'en';
}

export function DesktopReview(): JSX.Element {
  const navigate = useNavigate();
  const [lang] = useState<Language>(detectInitialLanguage);
  const [data, setData] = useState<PanelData>({
    arrears: [],
    maintenance: [],
    approvals: [],
    insights: [],
  });
  const [lastUpdatedIso, setLastUpdatedIso] = useState<string | null>(null);
  const [celebrateTender, setCelebrateTender] = useState<{
    readonly tenantId: string;
    readonly userId: string;
  } | null>(null);

  const t = LABELS[lang];

  const reload = useCallback(() => {
    fetchPanelData().then((next) => {
      setData(next);
      setLastUpdatedIso(new Date().toISOString());
    });
  }, []);

  useEffect(() => {
    reload();
    const handle = window.setInterval(reload, 30000);
    return () => window.clearInterval(handle);
  }, [reload]);

  const askMrMwikila = useCallback(
    (kind: string, contextId: string) => {
      const params = new URLSearchParams({ context: `${kind}:${contextId}` });
      navigate(`/manager-chat?${params.toString()}`);
    },
    [navigate],
  );

  const handleAction = useCallback(
    (action: QuickAction, kind: string, id: string) => {
      if (action === 'ask') {
        askMrMwikila(kind, id);
        return;
      }
      const approval = data.approvals.find((a) => a.id === id);
      if (
        action === 'approve' &&
        kind === 'approval' &&
        approval?.kind === 'tender-award'
      ) {
        setCelebrateTender({ tenantId: 'current', userId: 'current' });
      }
      const params = new URLSearchParams({
        context: `${kind}:${id}`,
        intent: action,
      });
      navigate(`/manager-chat?${params.toString()}`);
    },
    [askMrMwikila, data.approvals, navigate],
  );

  const updatedDisplay = useMemo(() => {
    if (!lastUpdatedIso) return '';
    const date = new Date(lastUpdatedIso);
    return date.toLocaleTimeString(lang === 'sw' ? 'sw-TZ' : 'en-US');
  }, [lang, lastUpdatedIso]);

  return (
    <div className="p-6 space-y-4">
      {celebrateTender ? (
        <ConfettiTrigger
          active={true}
          kind="tender-awarded"
          tenantId={celebrateTender.tenantId}
          userId={celebrateTender.userId}
          onComplete={() => setCelebrateTender(null)}
        />
      ) : null}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t.title}</h1>
          <p className="text-sm text-gray-600">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdatedIso && (
            <span className="text-xs text-gray-500">
              {t.updated}: {updatedDisplay}
            </span>
          )}
          <button
            type="button"
            onClick={reload}
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            {t.refresh}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ArrearsPanel
          title={t.arrearsTitle}
          emptyLabel={t.empty}
          items={data.arrears}
          labels={t}
          onAction={handleAction}
        />
        <MaintenancePanel
          title={t.maintenanceTitle}
          emptyLabel={t.empty}
          items={data.maintenance}
          labels={t}
          onAction={handleAction}
        />
        <ApprovalsPanel
          title={t.approvalsTitle}
          emptyLabel={t.empty}
          items={data.approvals}
          labels={t}
          onAction={handleAction}
        />
        <InsightsPanel
          title={t.insightsTitle}
          emptyLabel={t.empty}
          items={data.insights}
          labels={t}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}

type ActionLabels = Record<string, string>;

interface PanelProps<T> {
  readonly title: string;
  readonly emptyLabel: string;
  readonly items: readonly T[];
  readonly labels: ActionLabels;
  readonly onAction: (action: QuickAction, kind: string, id: string) => void;
}

function PanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </header>
      <div className="p-4 space-y-2">{children}</div>
    </section>
  );
}

function ActionBar({
  labels,
  onAction,
  kind,
  id,
}: {
  labels: ActionLabels;
  onAction: PanelProps<unknown>['onAction'];
  kind: string;
  id: string;
}): JSX.Element {
  return (
    <div className="flex gap-2 mt-2">
      <button
        type="button"
        onClick={() => onAction('approve', kind, id)}
        className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
      >
        {labels.approve}
      </button>
      <button
        type="button"
        onClick={() => onAction('delegate', kind, id)}
        className="px-2 py-1 text-xs rounded bg-yellow-500 text-white hover:bg-yellow-600"
      >
        {labels.delegate}
      </button>
      <button
        type="button"
        onClick={() => onAction('escalate', kind, id)}
        className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
      >
        {labels.escalate}
      </button>
      <button
        type="button"
        onClick={() => onAction('ask', kind, id)}
        className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        {labels.ask}
      </button>
    </div>
  );
}

function ArrearsPanel(props: PanelProps<ArrearsItem>): JSX.Element {
  return (
    <PanelShell title={props.title}>
      {props.items.length === 0 ? (
        <p className="text-sm text-gray-500">{props.emptyLabel}</p>
      ) : (
        props.items.map((item) => (
          <div key={item.id} className="p-2 border border-gray-100 rounded">
            <div className="text-sm font-medium text-gray-900">
              {item.tenantName} — {item.unit}
            </div>
            <div className="text-xs text-gray-600">
              {item.amountDue} {item.currency} · {item.daysLate}d late · {item.ladderStep}
            </div>
            <ActionBar
              labels={props.labels}
              onAction={props.onAction}
              kind="arrears"
              id={item.id}
            />
          </div>
        ))
      )}
    </PanelShell>
  );
}

function MaintenancePanel(props: PanelProps<MaintenanceItem>): JSX.Element {
  return (
    <PanelShell title={props.title}>
      {props.items.length === 0 ? (
        <p className="text-sm text-gray-500">{props.emptyLabel}</p>
      ) : (
        props.items.map((item) => (
          <div key={item.id} className="p-2 border border-gray-100 rounded">
            <div className="text-sm font-medium text-gray-900">
              {item.property} · {item.unit}
            </div>
            <div className="text-xs text-gray-600">
              {item.category} · {item.severity}
            </div>
            <ActionBar
              labels={props.labels}
              onAction={props.onAction}
              kind="maintenance"
              id={item.id}
            />
          </div>
        ))
      )}
    </PanelShell>
  );
}

function ApprovalsPanel(props: PanelProps<ApprovalItem>): JSX.Element {
  return (
    <PanelShell title={props.title}>
      {props.items.length === 0 ? (
        <p className="text-sm text-gray-500">{props.emptyLabel}</p>
      ) : (
        props.items.map((item) => (
          <div key={item.id} className="p-2 border border-gray-100 rounded">
            <div className="text-sm font-medium text-gray-900">{item.kind}</div>
            <div className="text-xs text-gray-600">
              {item.summary} · {item.requester} · {item.waitingSinceHours}h
            </div>
            <ActionBar
              labels={props.labels}
              onAction={props.onAction}
              kind="approval"
              id={item.id}
            />
          </div>
        ))
      )}
    </PanelShell>
  );
}

function InsightsPanel(props: PanelProps<InsightItem>): JSX.Element {
  return (
    <PanelShell title={props.title}>
      {props.items.length === 0 ? (
        <p className="text-sm text-gray-500">{props.emptyLabel}</p>
      ) : (
        props.items.map((item) => (
          <div key={item.id} className="p-2 border border-gray-100 rounded">
            <div className="text-sm font-medium text-gray-900">{item.title}</div>
            <div className="text-xs text-gray-600">{item.description}</div>
            <ActionBar
              labels={props.labels}
              onAction={props.onAction}
              kind="insight"
              id={item.id}
            />
          </div>
        ))
      )}
    </PanelShell>
  );
}

export default DesktopReview;
