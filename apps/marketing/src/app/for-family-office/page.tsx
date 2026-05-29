import type { Metadata } from 'next';
import { Crown } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For family offices — Boss Nyumba',
  description:
    'Multi-entity consolidation, daily NAV, succession-ready entity maps, treasury sweep, FX hedging, living asset register. Built for the long-horizon owner.',
};

export default function ForFamilyOfficePage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.familyOffice} kickerIcon={Crown} />
    </PageShell>
  );
}
