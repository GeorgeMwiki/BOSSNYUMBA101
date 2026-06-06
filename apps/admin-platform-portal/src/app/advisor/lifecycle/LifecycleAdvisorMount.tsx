'use client';

import dynamic from 'next/dynamic';
import { AdvisorLoading } from '../_lib/states';

// Client-only mount: `next/dynamic` with `ssr: false` is only permitted
// inside a Client Component (Next.js 15). The server `page.tsx` keeps its
// `metadata` export and renders this wrapper. `ssr: false` stays because
// the advisor bundle is browser-only.
const LifecycleAdvisorClient = dynamic(
  () =>
    import('./LifecycleAdvisorClient.js').then((m) => ({
      default: m.LifecycleAdvisorClient,
    })),
  {
    ssr: false,
    loading: () => <AdvisorLoading label="Loading lifecycle advisor…" />,
  },
);

export function LifecycleAdvisorMount() {
  return <LifecycleAdvisorClient />;
}
