'use client';

/**
 * SpawnedTabsStrip — horizontal chip strip rendering the brain-spawned
 * (or HQ operator-spawned) tabs above the main HQ page content.
 *
 * Mirrors apps/owner-portal/src/components/SpawnedTabsStrip.tsx but
 * uses next/navigation since the admin-platform-portal is a Next.js
 * app (the owner-portal is Vite + react-router-dom).
 */

import { useRouter } from 'next/navigation';
import { useAdminTabs } from '../state/AdminTabsProvider';

/**
 * HQ tab kinds → canonical routes. Built-in kinds (chat) are
 * non-navigable. Unknown kinds keep the chip clickable for focus only.
 */
const TAB_ROUTES: Record<string, string | undefined> = {
  chat: undefined,
  insights: '/insights',
  'decision-trace': '/decision-trace',
  advisor: '/advisor',
  ask: '/ask',
  'mission-eval': '/mission-eval',
  'legacy-migration': '/legacy-migration',
};

export function SpawnedTabsStrip(): JSX.Element | null {
  const { tabs, activeTabId, focus, close, acknowledgeAugmentation } =
    useAdminTabs();
  const router = useRouter();

  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label="Open HQ tabs"
      className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-3 py-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const pending = tab.pendingUpdates ?? 0;
        const route = TAB_ROUTES[tab.kind];
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              focus(tab.id);
              if (pending > 0) acknowledgeAugmentation(tab.id);
              if (route) router.push(route);
            }}
            className={[
              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition',
              isActive
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                : 'border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]',
            ].join(' ')}
          >
            <span>{tab.title}</span>
            {pending > 0 && (
              <span
                aria-label={`${pending} update${pending === 1 ? '' : 's'}`}
                className="ml-1 rounded-full bg-amber-400/30 px-1.5 text-[10px] font-medium text-amber-100"
              >
                +{pending}
              </span>
            )}
            {!tab.pinned && (
              <span
                role="button"
                tabIndex={0}
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
                aria-label={`Close ${tab.title}`}
                className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full text-[10px] text-white/40 hover:text-white"
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
