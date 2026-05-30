import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For corporate portfolios — BossNyumba',
  description:
    'BossNyumba runs corporate property portfolios — staff housing, branch offices, warehouses — as one operating system. Mr. Mwikila consolidates leases, levies, maintenance, and treasury across every entity.',
};

export default function ForCorporatePortfolioPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.corporatePortfolio} kickerIcon={Building2} />
    </PageShell>
  );
}
