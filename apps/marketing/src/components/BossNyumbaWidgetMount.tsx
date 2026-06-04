'use client';
/**
 * BossNyumbaWidgetMount — marketing-site (anonymous / public) mount of the
 * unified Mr. Mwikila floating chat widget.
 *
 * Wires the CANONICAL `BossnyumbaAIProvider` + `FloatingChatWidget` pair —
 * the same one every product portal uses (customer/owner/estate-manager
 * MwikilaWidgetMount). The marketing app had been left on the pre-debrand
 * `LitFinAIProvider` + `LitFinWidget` pair; `FloatingChatWidget` reads the
 * `BossnyumbaAIContext` (via `useOptionalBossnyumbaAI`) and returns `null`
 * when that context is absent — so under the old wiring the floating bubble
 * never rendered. This restores it.
 *
 * Talks to `/api/chat` (the Next route handler that adapts the widget shape
 * to the BN api-gateway's public chat endpoint). Lazy-loaded `ssr: false`
 * so the widget bundle never enters the SSR module graph.
 */
import type { ReactNode } from 'react';
import { BossnyumbaAIProvider, FloatingChatWidget } from '@bossnyumba/chat-ui';

// Provider AND widget come from the SAME static import so they share one
// `@bossnyumba/chat-ui` module instance — and therefore one `BossnyumbaAIContext`
// object. The marketing app builds with webpack (the product portals use
// turbopack via `--turbo`); under webpack a `dynamic(() => import('@bossnyumba/
// chat-ui'))` for the widget loaded a SECOND copy of the module, so the widget's
// `useOptionalBossnyumbaAI()` read a different context than the provider supplied
// → `ctx` was null → `FloatingChatWidget` returned null → no bubble. This whole
// mount is already a client-only island, and `FloatingChatWidget` is SSR-safe
// (window access is effect-guarded), so a static import is correct here.

interface BossNyumbaWidgetMountProps {
  readonly locale?: 'en' | 'sw';
}

export function BossNyumbaWidgetMount({
  locale = 'en',
}: BossNyumbaWidgetMountProps = {}): JSX.Element {
  return (
    <BossnyumbaAIProvider
      portal="public"
      defaultPersona="public-chat"
      defaultLanguage={locale}
      endpoint="/api/chat"
      featureEnabled
    >
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}

export function BossNyumbaWidgetSlot({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
