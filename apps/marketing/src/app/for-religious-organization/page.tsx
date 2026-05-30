import type { Metadata } from 'next';
import { Church } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For religious organisations — BossNyumba',
  description:
    'BossNyumba runs the property estate of mosques, churches, temples, and dioceses. Congregation-transparent dues ledger, AGM-ready trustee statements, faith-aligned governance, hash-chained on every action.',
};

export default function ForReligiousOrganizationPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.religiousOrganization} kickerIcon={Church} />
    </PageShell>
  );
}
