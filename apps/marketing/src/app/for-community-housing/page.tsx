import type { Metadata } from 'next';
import { HeartHandshake } from 'lucide-react';
import { PageShell } from '@/components/shared/PageShell';
import { AudiencePage } from '@/components/audience/AudiencePage';
import { getMessages } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getMessages(locale).audiencePages.communityHousing;
  return { title: t.metaTitle, description: t.metaDescription };
}

export default async function ForCommunityHousingPage() {
  const locale = await getLocale();
  const copy = getMessages(locale).audiencePages.communityHousing;
  return (
    <PageShell>
      <AudiencePage copy={copy} kickerIcon={HeartHandshake} />
    </PageShell>
  );
}
