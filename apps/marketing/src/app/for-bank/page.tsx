import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For banks + property finance — BossNyumba',
  description:
    'Hash-chained property cash flows and a computed landlord credit score for underwriting. Bank the underbanked landlord with confidence. Consented API credit feed on the roadmap.',
};

export default async function ForBankPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('bank', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Landmark} />
    </PageShell>
  );
}
