import type { Metadata } from 'next';
import { Globe } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For diplomatic missions and NGOs — BossNyumba',
  description:
    'BossNyumba runs the property estate of diplomatic missions, international NGOs, and donor agencies across multiple capitals. Donor-audit-ready ledger, jurisdiction-aware compliance, multi-currency NAV.',
};

export default function ForEmbassyNgoPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.embassyNgo} kickerIcon={Globe} />
    </PageShell>
  );
}
