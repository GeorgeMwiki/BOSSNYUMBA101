import type { Metadata } from 'next';
import { Handshake } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa mawakala wa upangishaji + makazi ya kampuni — BossNyumba',
      description:
        'Pata orodha ya mali iliyothibitishwa kote Tanzania na Kenya. Linganisha wateja watarajiwa kwa kilinganishi cha AI. Tengeneza ofa za makazi ya kampuni ndani ya dakika chache. Lipwa kamisheni kiotomatiki pindi mkataba unapotekelezwa.',
    };
  }
  return {
    title: 'For leasing agencies + corporate housing — BossNyumba',
    description:
      'Source verified inventory across TZ and KE. Match prospects with the AI matcher. Generate corporate-housing offers in minutes. Get paid commission automatically on lease execution.',
  };
}

export default async function ForLeasingAgencyPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('leasingAgency', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Handshake} />
    </PageShell>
  );
}
