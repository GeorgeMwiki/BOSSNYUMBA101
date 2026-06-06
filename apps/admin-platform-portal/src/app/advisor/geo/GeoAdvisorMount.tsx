'use client';

import dynamic from 'next/dynamic';
import { AdvisorLoading } from '../_lib/states';

// Client-only mount: `next/dynamic` with `ssr: false` is only permitted
// inside a Client Component (Next.js 15). The server `page.tsx` keeps its
// `metadata` export and renders this wrapper.
//
// Geo advisor is the heaviest of the eight — pulls in MapLibre/Leaflet
// via ParcelMap.tsx. Dynamic + ssr:false keeps map deps out of the
// server build entirely. The map is useless server-side anyway.
const GeoAdvisorClient = dynamic(
  () =>
    import('./GeoAdvisorClient.js').then((m) => ({
      default: m.GeoAdvisorClient,
    })),
  {
    ssr: false,
    loading: () => <AdvisorLoading label="Loading map + advisor panel…" />,
  },
);

export function GeoAdvisorMount() {
  return <GeoAdvisorClient />;
}
