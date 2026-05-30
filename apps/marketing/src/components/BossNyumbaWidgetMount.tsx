'use client';
/**
 * BossNyumbaWidgetMount — marketing-site (anonymous) wrapper around the
 * @bossnyumba/chat-ui FloatingChatWidget.
 *
 * Renders the floating "Mr. Mwikila — BossNyumba's AI Real-Estate
 * Managing Director" bubble across every marketing page. Uses the
 * `public` portal/persona — talks to the public-chat endpoint at
 * /api/v1/public/chat (served by the BN api-gateway) which returns
 * curated BN-about-BN responses (no tenant data, no auth required).
 *
 * SOTA lazy-load
 * --------------
 * The widget is loaded via `next/dynamic({ ssr: false })` so the entire
 * `@bossnyumba/chat-ui` bundle is excluded from the server-render module
 * graph. Three wins:
 *   1. SSR is faster — no chat-ui parse/eval on the server.
 *   2. Smaller SSR JS payload — none of chat-ui's transitive deps ship
 *      in the initial HTML.
 *   3. Defense in depth — even if a future chat-ui dep adds a
 *      `typeof window` access at module-load, SSR can't see it.
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const BossnyumbaAIProvider = dynamic(
  () => import('@bossnyumba/chat-ui').then((m) => ({ default: m.BossnyumbaAIProvider })),
  { ssr: false },
);

const FloatingChatWidget = dynamic(
  () => import('@bossnyumba/chat-ui').then((m) => ({ default: m.FloatingChatWidget })),
  { ssr: false },
);

interface BossNyumbaWidgetMountProps {
  readonly locale?: 'en' | 'sw';
}

/**
 * Resolve the API gateway base URL for the public-chat endpoint.
 * Falls back to relative paths so the widget can be reverse-proxied
 * behind the same origin in development.
 */
function resolvePublicChatEndpoint(): string {
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '').replace(/\/$/, '');
  return `${base}/api/v1/public/chat`;
}

export function BossNyumbaWidgetMount({ locale = 'en' }: BossNyumbaWidgetMountProps): JSX.Element {
  return (
    <BossnyumbaAIProvider
      portal="public"
      defaultPersona="public-chat"
      defaultLanguage={locale}
      featureEnabled
      endpoint={resolvePublicChatEndpoint()}
      tenantId={null}
    >
      <FloatingChatWidget />
    </BossnyumbaAIProvider>
  );
}

/**
 * Slot helper so children that need the provider context can compose
 * without remounting it. Currently unused but kept available for
 * page-level surfaces that want to share the marketing chat session.
 */
export function BossNyumbaWidgetSlot({ children }: { readonly children: ReactNode }): JSX.Element {
  return <>{children}</>;
}
