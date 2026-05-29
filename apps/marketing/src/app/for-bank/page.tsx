import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For banks + property finance — Boss Nyumba',
  description:
    'Hash-chained property cash flows, conformal DSCR projections, API-first credit feed. Bank the underbanked landlord with confidence.',
};

export default function ForBankPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.bank} kickerIcon={Landmark} />
    </PageShell>
  );
}
