import type { Metadata } from 'next';
import { Crown } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For family offices — BossNyumba',
  description:
    'One audit-ready, hash-chained ledger across every entity and currency, with owner statements and portfolio analytics. Built for the long-horizon owner.',
};

export default async function ForFamilyOfficePage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('familyOffice', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Crown} />
    </PageShell>
  );
}
