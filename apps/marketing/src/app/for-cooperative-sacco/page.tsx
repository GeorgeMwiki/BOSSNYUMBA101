import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For SACCOs and cooperatives — BossNyumba',
  description:
    'BossNyumba runs the property estate of SACCOs, cooperative societies, and member-investment groups. Member-transparent dues ledger, allocation lottery, registrar-ready AGM filings, and one-tap consolidated statements.',
};

export default async function ForCooperativeSaccoPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('cooperativeSacco', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Users} />
    </PageShell>
  );
}
