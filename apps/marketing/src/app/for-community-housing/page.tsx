import type { Metadata } from 'next';
import { HeartHandshake } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For community housing — BossNyumba',
  description:
    'Cooperative housing, community land trusts, worker-housing partnerships. Transparent dues, fair allocation lottery, AGM-ready records, donor impact packs. 30% community discount.',
};

export default async function ForCommunityHousingPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('communityHousing', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={HeartHandshake} />
    </PageShell>
  );
}
