import type { Metadata } from 'next';
import { TrendingUp } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa wawekezaji wa mali — BossNyumba',
      description:
        'IRR ya miaka mitano yenye uhakika wa kiwango (conformal) kwa kila mali unayofikiria kununua. Mnyororo wa hatimiliki, mpangilio wa matumizi ya ardhi, mauzo yanayolingana, orodha za kodi, na historia ya tozo — yote yamekaguliwa. Kisha tunaiendesha kwa niaba yako baada ya kununua.',
    };
  }
  return {
    title: 'For real-estate investors — BossNyumba',
    description:
      'Five-year IRR with conformal confidence for every prospect property. Title chain, zoning, comparable sales, rent rolls, levy history — all audited. Then operates it for you after you buy.',
  };
}

export default async function ForRealEstateInvestorPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('realEstateInvestor', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={TrendingUp} />
    </PageShell>
  );
}
