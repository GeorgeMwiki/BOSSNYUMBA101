import type { Metadata } from 'next';
import { Home } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getMessages } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getMessages(locale).audiencePages.individualLandlord;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function ForIndividualLandlordPage() {
  const locale = await getLocale();
  const copy = getMessages(locale).audiencePages.individualLandlord;
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Home} />
    </PageShell>
  );
}
