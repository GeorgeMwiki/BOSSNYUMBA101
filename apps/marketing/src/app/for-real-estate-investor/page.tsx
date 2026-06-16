import type { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For real-estate investors — BossNyumba',
  description:
    'Five-year IRR with conformal confidence for every prospect property. Title chain, zoning, comparable sales, rent rolls, levy history — all audited. Then operates it for you after you buy.',
};

export default async function ForRealEstateInvestorPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('realEstateInvestor', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={TrendingUp} />
    </PageShell>
  );
}
