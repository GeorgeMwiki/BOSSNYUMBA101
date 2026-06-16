import type { Metadata } from 'next';
import { Church } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa mashirika ya kidini — BossNyumba',
      description:
        'BossNyumba huendesha mali za misikiti, makanisa, mahekalu, na majimbo ya kidini. Leja ya michango yenye uwazi kwa waumini, taarifa za wadhamini zilizo tayari kwa mkutano mkuu wa mwaka, utawala unaolingana na imani, na njia ya ukaguzi iliyofungwa kwa minyororo ya hash kwa kila tendo.',
    };
  }
  return {
    title: 'For religious organisations — BossNyumba',
    description:
      'BossNyumba runs the property estate of mosques, churches, temples, and dioceses. Congregation-transparent dues ledger, AGM-ready trustee statements, faith-aligned governance, hash-chained on every action.',
  };
}

export default async function ForReligiousOrganizationPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('religiousOrganization', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Church} />
    </PageShell>
  );
}
