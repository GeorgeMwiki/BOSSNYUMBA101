import type { Metadata } from 'next';
import { Scale } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa wadhibiti wa nyumba — BossNyumba',
      description:
        'Ishara ya soko ya moja kwa moja, isiyobainisha utambulisho, iliyofungwa kwa mnyororo wa hashi: idadi ya mikataba, wastani wa kodi za wilaya, wingi wa migogoro, na utii wa ada za halmashauri. Ridhaa ya mpangaji kwanza; faragha ya kitofauti imehakikishwa; imewekewa mipaka kikatiba.',
    };
  }
  return {
    title: 'For housing regulators — BossNyumba',
    description:
      'Live, anonymised, hash-chained market signal: lease counts, district median rents, dispute volumes, council-levy compliance. Tenant-consent first; differentially private; constitutionally bounded.',
  };
}

export default async function ForRegulatorPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('regulator', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Scale} />
    </PageShell>
  );
}
