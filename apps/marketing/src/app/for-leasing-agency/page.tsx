import type { Metadata } from 'next';
import { Handshake } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For leasing agencies + corporate housing — Boss Nyumba',
  description:
    'Source verified inventory across TZ and KE. Match prospects with the AI matcher. Generate corporate-housing offers in minutes. Get paid commission automatically on lease execution.',
};

export default function ForLeasingAgencyPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.leasingAgency} kickerIcon={Handshake} />
    </PageShell>
  );
}
