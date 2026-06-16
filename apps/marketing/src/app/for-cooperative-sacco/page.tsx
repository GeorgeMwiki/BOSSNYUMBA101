import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa SACCO na vyama vya ushirika — BossNyumba',
      description:
        'BossNyumba inaendesha mali ya SACCO, vyama vya ushirika, na vikundi vya uwekezaji vya wanachama. Leja ya michango iliyo wazi kwa wanachama, bahati nasibu ya ugawaji, mafaili ya mkutano mkuu yaliyo tayari kwa msajili, na taarifa zilizojumlishwa kwa mguso mmoja.',
    };
  }
  return {
    title: 'For SACCOs and cooperatives — BossNyumba',
    description:
      'BossNyumba runs the property estate of SACCOs, cooperative societies, and member-investment groups. Member-transparent dues ledger, allocation lottery, registrar-ready AGM filings, and one-tap consolidated statements.',
  };
}

export default async function ForCooperativeSaccoPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('cooperativeSacco', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Users} />
    </PageShell>
  );
}
