import type { Metadata } from 'next';
import { HeartHandshake } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For community housing — BossNyumba',
  description:
    'Cooperative housing, community land trusts, worker-housing partnerships. Transparent dues, fair allocation lottery, AGM-ready records, donor impact packs. 30% community discount.',
};

export default function ForCommunityHousingPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.communityHousing} kickerIcon={HeartHandshake} />
    </PageShell>
  );
}
