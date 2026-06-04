'use client';
/**
 * BossNyumbaWidgetMount — marketing-site (anonymous) wrapper around the
 * @bossnyumba/chat-ui floating widget.
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

/**
 * BossNyumba real-estate compliance copy. Landlords own properties — the
 * parent fork's variant said "owner" of a different asset class. We pin
 * "landlord" here so an unrelated edit (or a sibling chat-ui session)
 * cannot revert it.
 */
const BOSSNYUMBA_DISCLAIMER_EN =
  'AI-generated. Not legal advice. Decisions are made by the landlord.';
const BOSSNYUMBA_DISCLAIMER_SW =
  'AI-iliyotengenezwa . Si ushauri wa kisheria . Maamuzi yanafanywa na mwenye nyumba';

export function BossNyumbaWidgetMount(
  _props: BossNyumbaWidgetMountProps = {},
): JSX.Element {
  return (
    <LitFinAIProvider
      portalId="public"
      endpoint="/api/chat"
      initialRoute="/"
      disclaimerEn={BOSSNYUMBA_DISCLAIMER_EN}
      disclaimerSw={BOSSNYUMBA_DISCLAIMER_SW}
    >
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
