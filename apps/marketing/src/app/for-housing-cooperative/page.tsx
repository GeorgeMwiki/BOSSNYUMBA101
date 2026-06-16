import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa ushirika wa nyumba — BossNyumba',
      description:
        'Mwonekano wa papo hapo wa ada zilizolipwa, matengenezo ya jengo, kalenda ya AGM, na salio la benki ya ushirika. Mwl. Mwikila hushughulikia ukusanyaji wa ada, migogoro na wauzaji, na hutengeneza kifurushi cha mafaili tayari kwa msajili kwa mguso mmoja. Punguzo la asilimia 30 kwa kila kiwango.',
    };
  }
  return {
    title: 'For housing cooperatives — BossNyumba',
    description:
      'Real-time view of dues paid, building maintenance, AGM calendar, cooperative bank balance. Mr. Mwikila handles dues collection, vendor disputes, and generates a registrar-ready filing pack in one tap. 30% off every tier.',
  };
}

export default async function ForHousingCooperativePage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('housingCooperative', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Users} />
    </PageShell>
  );
}
