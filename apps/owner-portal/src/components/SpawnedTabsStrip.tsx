/**
 * SpawnedTabsStrip — horizontal chip strip rendering the brain-spawned
 * (or owner-spawned) tabs above the main page content.
 *
 * Minimum-viable shape for the initial port: a chip per open tab with
 * a focus action + close button + "+N updates" badge when the brain
 * augmented the tab while it was unfocused. Clicking a chip focuses
 * the tab in the store AND navigates to the matching route so the
 * user actually lands on the relevant page.
 *
 * Future enhancements (not in this port):
 *   - drag-to-reorder
 *   - SpawnTabMenu ("+") manual spawner
 *   - per-tab inline panels rendered inside the strip
 */

import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useOwnerTabs } from '../state/OwnerTabsProvider';
import type { OwnerTabKind } from '../state/useOwnerTabs';

/**
 * Route map — every spawnable tab kind has a canonical route in the
 * owner-portal. Built-ins ("chat") are non-navigable (the chat is
 * always-on via the floating widget) so we leave them out.
 *
 * If a kind has no route the chip is still clickable — it just focuses
 * the tab without navigating. That keeps the UX consistent while routes
 * are still being built out.
 */
const TAB_ROUTES: Partial<Record<OwnerTabKind, string>> = {
  rent: '/financial',
  leases: '/tenants',
  tenants: '/tenants',
  maintenance: '/maintenance',
  inspections: '/maintenance',
  vendors: '/vendors',
  hr: '/users',
  ops: '/operations',
  finance: '/financial',
  accounting: '/financial',
  risk: '/compliance',
  compliance: '/compliance',
  workforce: '/workforce',
  procurement: '/vendors',
  audit: '/audit-log',
  legal: '/compliance',
  insurance: '/compliance/insurance',
  marketing: '/communications',
  treasury: '/financial/disbursements',
  marketplace: '/parcels-marketplace',
  licences: '/compliance/licenses',
  properties: '/properties',
  safety: '/compliance',
  reports: '/reports',
  // built-ins / docs / etc.
  docs: '/documents',
  drafts: '/documents',
  reminders: '/dashboard',
  insights: '/analytics',
};

export function SpawnedTabsStrip(): JSX.Element | null {
  const { tabs, activeTabId, focus, close, acknowledgeAugmentation } =
    useOwnerTabs();
  const navigate = useNavigate();
  const tA11y = useTranslations('a11y');

  // Don't render until at least one non-builtin tab exists — the
  // initial state has the pinned `chat` tab which would render an
  // empty-looking single-chip strip.
  const spawnedTabs = tabs.filter((t) => t.kind !== 'chat');
  if (spawnedTabs.length === 0) return null;

  return (
    <div
      data-testid="spawned-tabs-strip"
      role="tablist"
      aria-label={tA11y('openTabs')}
      className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2"
    >
      {spawnedTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const pending = tab.pendingUpdates ?? 0;
        const route = TAB_ROUTES[tab.kind];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`tab-chip-${tab.id}`}
            onClick={() => {
              focus(tab.id);
              acknowledgeAugmentation(tab.id);
              if (route) navigate(route);
            }}
            className={
              'group inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors ' +
              (isActive
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100')
            }
          >
            <span>{tab.title}</span>
            {pending > 0 ? (
              <span
                data-testid={`tab-chip-${tab.id}-pending`}
                aria-label={tA11y('tabUpdates', { count: pending })}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-semibold text-white"
              >
                +{pending}
              </span>
            ) : null}
            {!tab.pinned ? (
              <span
                role="button"
                tabIndex={-1}
                data-testid={`tab-chip-${tab.id}-close`}
                aria-label={tA11y('closeTab', { title: tab.title })}
                onClick={(e) => {
                  e.stopPropagation();
                  close(tab.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(tab.id);
                  }
                }}
                className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
