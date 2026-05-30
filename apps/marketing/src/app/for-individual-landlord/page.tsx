import type { Metadata } from 'next';
import { Home } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For the individual landlord — Boss Nyumba',
  description:
    'Mr. Mwikila collects rent over M-Pesa, chases late tenants politely, files the council levy, and emails you a one-page owner statement. Free on the Smallholder tier (T1) for up to 5 units.',
};

export default function ForIndividualLandlordPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.individualLandlord} kickerIcon={Home} />
    </PageShell>
  );
}
