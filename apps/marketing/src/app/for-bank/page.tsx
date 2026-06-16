import type { Metadata } from 'next';
import { Landmark } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getAudienceCopy } from '@/lib/audience-copy';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  if (locale === 'sw') {
    return {
      title: 'Kwa benki + ufadhili wa mali — BossNyumba',
      description:
        'Mtiririko wa fedha wa mali uliofungwa kwa mnyororo wa hash na alama ya mkopo ya mwenye nyumba iliyokokotolewa kwa ajili ya tathmini ya mikopo. Wapatie wenye nyumba wasiofikiwa na huduma za benki mikopo kwa uhakika. Mlisho wa mkopo wa API kwa idhini upo katika mpango wa siku zijazo.',
    };
  }
  return {
    title: 'For banks + property finance — BossNyumba',
    description:
      'Hash-chained property cash flows and a computed landlord credit score for underwriting. Bank the underbanked landlord with confidence. Consented API credit feed on the roadmap.',
  };
}

export default async function ForBankPage() {
  const locale = await getLocale();
  const copy = getAudienceCopy('bank', locale);
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Landmark} />
    </PageShell>
  );
}
