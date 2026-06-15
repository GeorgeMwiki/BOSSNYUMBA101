import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For banks + property finance — BossNyumba',
  description:
    'Hash-chained property cash flows and a computed landlord credit score for underwriting. Bank the underbanked landlord with confidence. Consented API credit feed on the roadmap.',
};

export default function ForBankPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.bank} kickerIcon={Landmark} />
    </PageShell>
  );
}
