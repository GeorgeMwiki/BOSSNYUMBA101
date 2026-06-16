import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'For universities and hospitals — BossNyumba',
  description:
    'BossNyumba is the operating system for universities, university colleges, hospitals, and teaching-hospital systems that hold large institutional property estates. Per-faculty P&L, donor-grade audit, sub-district maintenance routing.',
};

export default async function ForInstitutionalLandlordPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('institutionalLandlord', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={GraduationCap} />
    </PageShell>
  );
}
