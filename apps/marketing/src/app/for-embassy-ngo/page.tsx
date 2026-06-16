import type { Metadata } from 'next';
import { Globe } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa balozi na mashirika yasiyo ya kiserikali — BossNyumba',
      description:
        'BossNyumba huendesha mali ya balozi, mashirika ya kimataifa yasiyo ya kiserikali, na mashirika ya wafadhili katika miji mikuu mbalimbali. Leja iliyo tayari kwa ukaguzi wa wafadhili, utii unaozingatia mamlaka ya kisheria, na NAV ya sarafu nyingi.',
    };
  }
  return {
    title: 'For diplomatic missions and NGOs — BossNyumba',
    description:
      'BossNyumba runs the property estate of diplomatic missions, international NGOs, and donor agencies across multiple capitals. Donor-audit-ready ledger, jurisdiction-aware compliance, multi-currency NAV.',
  };
}

export default async function ForEmbassyNgoPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('embassyNgo', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Globe} />
    </PageShell>
  );
}
