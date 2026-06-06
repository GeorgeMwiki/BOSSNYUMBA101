'use client';

/**
 * MwikilaWidgetMount — estate-manager-app flavour.
 * Coworker persona; auto-flexes maintenance/leasing/finance sub-personas
 * depending on route. On mount we also peek at `/api/v1/training/next-step`
 * so Mr. Mwikila can proactively open a teaching conversation whenever the
 * employee has an outstanding adaptive-training assignment.
 *
 * SOTA lazy-load — the floating chat widget bundle is loaded via
 * `next/dynamic({ ssr: false })` so the heavy widget never enters the
 * SSR module graph. Cuts SSR JS payload + parse time and guarantees no
 * future window-touching transitive dep can ever crash boot. The
 * `BossnyumbaAIProvider` stays in the server graph because it only
 * provides context — the visible/interactive widget is what we defer.
 */
import { useEffect, useState } from 'react';
import type React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { BossnyumbaAIProvider } from '@bossnyumba/chat-ui';
import { useAuth } from '@/providers/AuthProvider';
import { getAccessToken } from '@/lib/supabase';

const FloatingChatWidget = dynamic(
  () => import('@bossnyumba/chat-ui').then((m) => m.FloatingChatWidget),
  { ssr: false },
);

interface MwikilaWidgetMountProps {
  readonly children: React.ReactNode;
}

interface TrainingNextStep {
  readonly greeting: string;
  readonly step: { readonly title: string; readonly conceptId: string };
  readonly path: { readonly title: string };
}

function useTrainingIntent(tenantId: string | null): void {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!tenantId || seen) return;
    if (typeof window === 'undefined') return;
    const ctrl = new AbortController();
    const base =
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
      '/api/v1';
    // Unified onto Supabase: resolve the bearer from the live session
    // (refreshes on the fly) instead of a stale `bossnyumba_token` key.
    void (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${base.replace(/\/$/, '')}/training/next-step`,
          {
            signal: ctrl.signal,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        const body = res.ok ? await res.json() : null;
        if (body?.success && body.data) {
          const detail = body.data as TrainingNextStep;
          window.dispatchEvent(
            new CustomEvent('bossnyumba:training-intent', { detail })
          );
        }
      } catch {
        /* ignore — widget still mounts without training-intent */
      } finally {
        setSeen(true);
      }
    })();
    return () => ctrl.abort();
  }, [tenantId, seen]);
}

export function MwikilaWidgetMount({ children }: MwikilaWidgetMountProps): JSX.Element {
  const pathname = usePathname() ?? '/';
  const auth = useAuth();
  const tenantId = auth.tenant?.id ?? null;
  useTrainingIntent(tenantId);

  return (
    <BossnyumbaAIProvider
      portal="estate-manager"
      defaultPersona="coworker"
      currentPath={pathname}
      tenantId={tenantId}
      getAuthToken={getAccessToken}
      featureEnabled={true}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
