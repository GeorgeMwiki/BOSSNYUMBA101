'use client';

import dynamic from 'next/dynamic';
import { AdvisorLoading } from '../_lib/states';

// Client-only mount: `next/dynamic` with `ssr: false` is only permitted
// inside a Client Component (Next.js 15). The server `page.tsx` keeps its
// `metadata` export and renders this wrapper.
//
// `dynamic` defers the client bundle until the page actually renders.
// `ssr: false` keeps the heavy form (zod schemas, validators, react-hook-
// form) out of the server build so TTFB stays low. Cite: nextjs.org/docs/
// app/getting-started/partial-prerendering (Next.js 15+).
const AcquisitionAdvisorClient = dynamic(
  () =>
    import('./AcquisitionAdvisorClient.js').then((m) => ({
      default: m.AcquisitionAdvisorClient,
    })),
  {
    ssr: false,
    loading: () => <AdvisorLoading label="Loading acquisition advisor…" />,
  },
);

export function AcquisitionAdvisorMount() {
  return <AcquisitionAdvisorClient />;
}
