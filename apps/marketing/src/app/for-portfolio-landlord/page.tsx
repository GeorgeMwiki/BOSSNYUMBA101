import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For the portfolio landlord — BossNyumba',
  description:
    'Scale from five units to 2,500. Cross-property cash flow, consolidated owner statements, autonomy dial, Master Brain reasoning. Built for the professional property manager.',
};

export default async function ForPortfolioLandlordPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('portfolioLandlord', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Building2} />
    </PageShell>
  );
}
