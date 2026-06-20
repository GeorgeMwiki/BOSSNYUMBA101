import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getMessages } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getMessages(locale).audiencePages.corporatePortfolio;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function ForCorporatePortfolioPage() {
  const locale = await getLocale();
  const copy = getMessages(locale).audiencePages.corporatePortfolio;
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Building2} />
    </PageShell>
  );
}
