import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa taasisi za serikali — BossNyumba',
      description:
        'BossNyumba huwapa mashirika ya umma, wizara, na taasisi za serikali za mikoa mfumo wa uendeshaji wenye uwazi na unaoweza kukaguliwa kwa ajili ya mali zao. Leja ya uaminifu wa umma, taarifa zilizo tayari kwa mkutano mkuu wa mwaka, na njia ya ukaguzi iliyofungwa kwa msururu wa hashi katika kila kitendo.',
    };
  }
  return {
    title: 'For government entities — BossNyumba',
    description:
      'BossNyumba gives parastatals, ministries, and regional government entities a transparent, auditable operating system for their property estate. Public-trust ledger, AGM-ready statements, hash-chained on every action.',
  };
}

export default async function ForGovernmentEntityPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('governmentEntity', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Landmark} />
    </PageShell>
  );
}
