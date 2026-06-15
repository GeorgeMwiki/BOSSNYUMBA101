import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For housing cooperatives — BossNyumba',
  description:
    'Real-time view of dues paid, building maintenance, AGM calendar, cooperative bank balance. Mr. Mwikila handles dues collection, vendor disputes, and generates a registrar-ready filing pack in one tap. 30% off every tier.',
};

export default function ForHousingCooperativePage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.housingCooperative} kickerIcon={Users} />
    </PageShell>
  );
}
