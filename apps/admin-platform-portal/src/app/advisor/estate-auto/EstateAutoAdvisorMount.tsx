'use client';

import dynamic from 'next/dynamic';
import { AdvisorLoading } from '../_lib/states';

// Client-only mount: `next/dynamic` with `ssr: false` is only permitted
// inside a Client Component (Next.js 15). The server `page.tsx` keeps its
// `metadata` export and renders this wrapper. `ssr: false` stays because
// the advisor bundle is browser-only.
const EstateAutoAdvisorClient = dynamic(
  () =>
    import('./EstateAutoAdvisorClient.js').then((m) => ({
      default: m.EstateAutoAdvisorClient,
    })),
  {
    ssr: false,
    loading: () => (
      <AdvisorLoading label="Loading estate-automation advisor…" />
    ),
  },
);

export function EstateAutoAdvisorMount() {
  return <EstateAutoAdvisorClient />;
}
