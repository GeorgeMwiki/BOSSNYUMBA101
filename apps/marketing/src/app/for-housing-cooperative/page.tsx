import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getMessages } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getMessages(locale).audiencePages.housingCooperative;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function ForHousingCooperativePage() {
  const locale = await getLocale();
  const copy = getMessages(locale).audiencePages.housingCooperative;
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={Users} />
    </PageShell>
  );
}
