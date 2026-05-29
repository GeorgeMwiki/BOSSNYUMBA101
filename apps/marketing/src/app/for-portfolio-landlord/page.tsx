import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For the portfolio landlord — Boss Nyumba',
  description:
    'Scale from five units to 2,500. Cross-property cash flow, consolidated owner statements, autonomy dial, Master Brain reasoning. Built for the professional property manager.',
};

export default function ForPortfolioLandlordPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.portfolioLandlord} kickerIcon={Building2} />
    </PageShell>
  );
}
