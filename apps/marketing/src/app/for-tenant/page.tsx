import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa wapangaji na watarajiwa — BossNyumba',
      description:
        'Vinjari matangazo yaliyothibitishwa kote Tanzania na Kenya. Omba, weka zabuni, na pakia NIDA yako kuthibitisha. Piga gumzo na Mwl. Mwikila kwa Kiswahili au Kiingereza. Hakuna matangazo ya kubuni.',
    };
  }
  return {
    title: 'For tenants and prospects — BossNyumba',
    description:
      'Browse verified listings across Tanzania and Kenya. Apply, place a bid, and upload your NIDA to verify. Chat with Mr. Mwikila in Swahili or English. No ghost listings.',
  };
}

export default async function ForTenantPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('tenant', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={KeyRound} />
    </PageShell>
  );
}
