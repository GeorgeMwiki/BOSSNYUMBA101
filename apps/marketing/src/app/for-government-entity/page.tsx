import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For government entities — BossNyumba',
  description:
    'BossNyumba gives parastatals, ministries, and regional government entities a transparent, auditable operating system for their property estate. Public-trust ledger, AGM-ready statements, hash-chained on every action.',
};

export default function ForGovernmentEntityPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.governmentEntity} kickerIcon={Landmark} />
    </PageShell>
  );
}
