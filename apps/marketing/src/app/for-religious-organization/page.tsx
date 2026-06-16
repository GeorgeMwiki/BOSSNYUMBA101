import type { Metadata } from 'next';
import { Church } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For religious organisations — BossNyumba',
  description:
    'BossNyumba runs the property estate of mosques, churches, temples, and dioceses. Congregation-transparent dues ledger, AGM-ready trustee statements, faith-aligned governance, hash-chained on every action.',
};

export default async function ForReligiousOrganizationPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('religiousOrganization', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Church} />
    </PageShell>
  );
}
