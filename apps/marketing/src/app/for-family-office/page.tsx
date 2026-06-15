import type { Metadata } from 'next';
import { Crown } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For family offices — BossNyumba',
  description:
    'One audit-ready, hash-chained ledger across every entity and currency, with owner statements and portfolio analytics. Built for the long-horizon owner.',
};

export default function ForFamilyOfficePage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.familyOffice} kickerIcon={Crown} />
    </PageShell>
  );
}
