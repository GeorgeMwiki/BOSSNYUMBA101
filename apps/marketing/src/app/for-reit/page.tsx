import type { Metadata } from 'next';
import { LineChart } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa REITs na mifuko ya uwekezaji wa mali — BossNyumba',
      description:
        'BossNyumba ni mfumo wa uendeshaji ambao REITs na mifuko ya kitaasisi ya uwekezaji wa mali huutumia kusimamia mali zao. P&L kwa kila mali, njia za ukaguzi zilizofungwa kwa minyororo ya hashi, uchambuzi wa kundi la mali, mauzo ya nje ya utii, na ripoti zilizounganishwa.',
    };
  }
  return {
    title: 'For REITs and property funds — BossNyumba',
    description:
      'BossNyumba is the operating system Real Estate Investment Trusts and institutional property funds run their estate on. Per-asset P&L, hash-chained audit trails, portfolio analytics, compliance exports, and consolidated reporting.',
  };
}

export default async function ForReitPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('reit', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={LineChart} />
    </PageShell>
  );
}
