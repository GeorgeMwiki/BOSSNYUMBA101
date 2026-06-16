import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa mwenye nyumba mwenye kundi la mali — BossNyumba',
      description:
        'Kua kutoka vyumba vitano hadi 2,500. Mtiririko wa fedha katika mali zote, taarifa za mwenye mali zilizounganishwa, kidhibiti cha kujiendesha, na uchambuzi wa Master Brain. Imejengwa kwa ajili ya msimamizi wa mali wa kitaalamu.',
    };
  }
  return {
    title: 'For the portfolio landlord — BossNyumba',
    description:
      'Scale from five units to 2,500. Cross-property cash flow, consolidated owner statements, autonomy dial, Master Brain reasoning. Built for the professional property manager.',
  };
}

export default async function ForPortfolioLandlordPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('portfolioLandlord', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Building2} />
    </PageShell>
  );
}
