import type { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For tenants and prospects — Boss Nyumba',
  description:
    'Browse verified listings across Tanzania and Kenya. Tour virtually. Sign your lease on your phone. Pay rent over M-Pesa. Digital receipt every month. No ghost listings.',
};

export default function ForTenantPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.tenant} kickerIcon={KeyRound} />
    </PageShell>
  );
}
