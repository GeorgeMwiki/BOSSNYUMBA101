import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For SACCOs and cooperatives — BossNyumba',
  description:
    'BossNyumba runs the property estate of SACCOs, cooperative societies, and member-investment groups. Member-transparent dues ledger, allocation lottery, registrar-ready AGM filings, and one-tap consolidated statements.',
};

export default function ForCooperativeSaccoPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.cooperativeSacco} kickerIcon={Users} />
    </PageShell>
  );
}
