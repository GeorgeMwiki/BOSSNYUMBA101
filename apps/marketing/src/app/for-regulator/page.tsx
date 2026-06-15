import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For housing regulators — BossNyumba',
  description:
    'Live, anonymised, hash-chained market signal: lease counts, district median rents, dispute volumes, council-levy compliance. Tenant-consent first; differentially private; constitutionally bounded.',
};

export default function ForRegulatorPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.regulator} kickerIcon={Scale} />
    </PageShell>
  );
}
