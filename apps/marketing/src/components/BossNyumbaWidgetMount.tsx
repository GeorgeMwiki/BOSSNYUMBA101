'use client';
/**
 * BossNyumbaWidgetMount — marketing-site (anonymous) wrapper around the
 * @bossnyumba/chat-ui LitFin-style floating widget.
 *
 * Renders the floating "Mr. Mwikila — BossNyumba's AI Real-Estate
 * Director" bubble across every marketing page. Uses the `public`
 * portal — talks to /api/chat (a Next route handler that adapts the
 * widget shape to the BN api-gateway's /api/v1/public/chat endpoint).
 */
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const LitFinAIProvider = dynamic(
  () =>
    import('@bossnyumba/chat-ui').then((m) => ({
      default: m.LitFinAIProvider,
    })),
  { ssr: false },
);

const LitFinWidget = dynamic(
  () =>
    import('@bossnyumba/chat-ui').then((m) => ({ default: m.LitFinWidget })),
  { ssr: false },
);

interface BossNyumbaWidgetMountProps {
  readonly locale?: 'en' | 'sw';
}

export function BossNyumbaWidgetMount(
  _props: BossNyumbaWidgetMountProps = {},
): JSX.Element {
  return (
    <LitFinAIProvider portalId="public" endpoint="/api/chat" initialRoute="/">
      <LitFinWidget />
    </LitFinAIProvider>
  );
}

export function BossNyumbaWidgetSlot({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
