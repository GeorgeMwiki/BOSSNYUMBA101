'use client';

/**
 * MarketingWidgetSlot — carbon copy of LitFin's MarketingWidgetSlot
 * pattern (LITFIN_PATH/src/components/marketing/MarketingWidgetSlot.tsx).
 *
 * Thin client wrapper around the existing BossNyumba floating widget,
 * dynamically imported so the chat-ui bundle never enters the SSR
 * graph. Lets the marketing layout stay an RSC while the widget
 * hydrates as an idle-priority client island.
 */

import dynamic from 'next/dynamic';
import type { Locale } from '@/lib/i18n';

const BossNyumbaWidgetMount = dynamic(
  () =>
    import('@/components/BossNyumbaWidgetMount').then((m) => ({
      default: m.BossNyumbaWidgetMount,
    })),
  // Layout is RSC; this dynamic is intentionally `ssr: false`-equivalent
  // by virtue of BossNyumbaWidgetMount itself loading the widget client-only.
);

interface MarketingWidgetSlotProps {
  readonly locale?: Locale;
}

export function MarketingWidgetSlot({ locale = 'en' }: MarketingWidgetSlotProps): JSX.Element {
  return <BossNyumbaWidgetMount locale={locale} />;
}
