'use client';

/**
 * MwikilaWidgetMount — estate-manager-app flavour.
 * Coworker persona; auto-flexes maintenance/leasing/finance sub-personas
 * depending on route. On mount we also peek at `/api/v1/training/next-step`
 * so Mr. Mwikila can proactively open a teaching conversation whenever the
 * employee has an outstanding adaptive-training assignment.
 */
import { useEffect, useState } from 'react';
import type React from 'react';
import { usePathname } from 'next/navigation';
import { BossnyumbaAIProvider, FloatingChatWidget } from '@bossnyumba/chat-ui';
import { useAuth } from '@/providers/AuthProvider';

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
    const token = window.localStorage.getItem('bossnyumba_token');
    fetch(`${base.replace(/\/$/, '')}/training/next-step`, {
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.success && body.data) {
          const detail = body.data as TrainingNextStep;
          window.dispatchEvent(
            new CustomEvent('bossnyumba:training-intent', { detail })
          );
        }
        setSeen(true);
      })
      .catch(() => {
        /* ignore — widget still mounts without training-intent */
      });
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
      featureEnabled={true}
    >
      {children}
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}
