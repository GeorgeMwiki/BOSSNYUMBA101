import type { Metadata } from 'next';
import { HeartHandshake } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa makazi ya jamii — BossNyumba',
      description:
        'Makazi ya ushirika, dhamana za ardhi za jamii, ushirikiano wa makazi ya wafanyakazi. Ada za uwazi, bahati nasibu ya ugawaji wa haki, kumbukumbu tayari kwa AGM, vifurushi vya athari kwa wafadhili. Punguzo la jamii la asilimia 30.',
    };
  }
  return {
    title: 'For community housing — BossNyumba',
    description:
      'Cooperative housing, community land trusts, worker-housing partnerships. Transparent dues, fair allocation lottery, AGM-ready records, donor impact packs. 30% community discount.',
  };
}

export default async function ForCommunityHousingPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('communityHousing', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={HeartHandshake} />
    </PageShell>
  );
}
