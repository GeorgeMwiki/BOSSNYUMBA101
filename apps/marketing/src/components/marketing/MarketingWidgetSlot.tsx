'use client';

/**
 * MarketingWidgetSlot — carbon copy of the upstream fork's MarketingWidgetSlot
 * pattern (UPSTREAM_PATH/src/components/marketing/MarketingWidgetSlot.tsx).
 *
 * Thin client wrapper around the existing BossNyumba floating widget,
 * dynamically imported so the chat-ui bundle never enters the SSR
 * graph. Lets the marketing layout stay an RSC while the widget
 * hydrates as an idle-priority client island.
 */

import type { Locale } from '@/lib/i18n';
import { BossNyumbaWidgetMount } from '@/components/BossNyumbaWidgetMount';

// Direct (static) import — matches the working product portals' single-
// boundary pattern. BossNyumbaWidgetMount is a `'use client'` component that
// already defers the heavy widget via `dynamic(FloatingChatWidget, { ssr:false })`.
// The previous double-nested dynamic (this slot dynamically importing the mount,
// which then dynamically imported the widget) left the inner ssr:false chunk
// un-requested, so the floating bubble never loaded.

interface MarketingWidgetSlotProps {
  readonly locale?: Locale;
}

export function MarketingWidgetSlot({ locale = 'en' }: MarketingWidgetSlotProps): JSX.Element {
  return <BossNyumbaWidgetMount locale={locale} />;
}
