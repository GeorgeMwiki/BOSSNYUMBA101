import type { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For real-estate investors — BossNyumba',
  description:
    'Five-year IRR with conformal confidence for every prospect property. Title chain, zoning, comparable sales, rent rolls, levy history — all audited. Then operates it for you after you buy.',
};

export default function ForRealEstateInvestorPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.realEstateInvestor} kickerIcon={TrendingUp} />
    </PageShell>
  );
}
