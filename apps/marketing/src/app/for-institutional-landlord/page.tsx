import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For universities and hospitals — BossNyumba',
  description:
    'BossNyumba is the operating system for universities, university colleges, hospitals, and teaching-hospital systems that hold large institutional property estates. Per-faculty P&L, donor-grade audit, sub-district maintenance routing.',
};

export default function ForInstitutionalLandlordPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.institutionalLandlord} kickerIcon={GraduationCap} />
    </PageShell>
  );
}
