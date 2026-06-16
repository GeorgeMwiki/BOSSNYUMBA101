import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For corporate portfolios — BossNyumba',
  description:
    'BossNyumba runs corporate property portfolios — staff housing, branch offices, warehouses — as one operating system. Mr. Mwikila consolidates leases, levies, maintenance, and treasury across every entity.',
};

export default async function ForCorporatePortfolioPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('corporatePortfolio', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Building2} />
    </PageShell>
  );
}
