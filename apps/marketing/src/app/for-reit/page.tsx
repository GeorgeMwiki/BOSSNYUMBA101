import type { Metadata } from 'next';
import { LineChart } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { COPY } from '@/lib/audience-copy';

export const metadata: Metadata = {
  title: 'For REITs and property funds — BossNyumba',
  description:
    'BossNyumba is the operating system Real Estate Investment Trusts and institutional property funds run their estate on. Per-asset P&L, hash-chained audit trails, portfolio analytics, compliance exports, and consolidated reporting.',
};

export default function ForReitPage() {
  return (
    <PageShell>
      <AudiencePage copy={COPY.reit} kickerIcon={LineChart} />
    </PageShell>
  );
}
