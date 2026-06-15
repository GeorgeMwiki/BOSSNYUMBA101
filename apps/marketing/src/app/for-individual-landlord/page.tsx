import type { Metadata } from 'next';
import { Home } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For the individual landlord — BossNyumba',
  description:
    'Mr. Mwikila collects rent over M-Pesa with one-tap tenant approval, sends polite late reminders automatically, prepares your council-levy filing for one-tap approval, and emails you a one-page owner statement. Free on the Smallholder tier (T1) for up to 5 units.',
};

export default async function ForIndividualLandlordPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('individualLandlord', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Home} />
    </PageShell>
  );
}
