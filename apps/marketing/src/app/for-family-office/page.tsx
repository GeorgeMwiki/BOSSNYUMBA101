import type { Metadata } from 'next';
import { Crown } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa ofisi za familia — BossNyumba',
      description:
        'Leja moja iliyo tayari kwa ukaguzi na iliyofungwa kwa minyororo ya hash katika kila taasisi na kila sarafu, ikiwa na taarifa za mwenye nyumba na uchanganuzi wa kundi la mali. Imejengwa kwa ajili ya mwenye nyumba mwenye mtazamo wa muda mrefu.',
    };
  }
  return {
    title: 'For family offices — BossNyumba',
    description:
      'One audit-ready, hash-chained ledger across every entity and currency, with owner statements and portfolio analytics. Built for the long-horizon owner.',
  };
}

export default async function ForFamilyOfficePage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('familyOffice', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Crown} />
    </PageShell>
  );
}
