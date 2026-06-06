'use client';

import dynamic from 'next/dynamic';
import { AdvisorLoading } from '../_lib/states';

// Client-only mount: `next/dynamic` with `ssr: false` is only permitted
// inside a Client Component (Next.js 15). The server `page.tsx` keeps its
// `metadata` export and renders this wrapper. `ssr: false` stays because
// the advisor bundle is browser-only.
const ExpansionAdvisorClient = dynamic(
  () =>
    import('./ExpansionAdvisorClient.js').then((m) => ({
      default: m.ExpansionAdvisorClient,
    })),
  {
    ssr: false,
    loading: () => <AdvisorLoading label="Loading expansion advisor…" />,
  },
);

export function ExpansionAdvisorMount() {
  return <ExpansionAdvisorClient />;
}
