import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For housing regulators — BossNyumba',
  description:
    'Live, anonymised, hash-chained market signal: lease counts, district median rents, dispute volumes, council-levy compliance. Tenant-consent first; differentially private; constitutionally bounded.',
};

export default async function ForRegulatorPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('regulator', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Scale} />
    </PageShell>
  );
}
