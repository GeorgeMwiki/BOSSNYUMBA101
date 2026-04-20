import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function CustomerTimeline() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('customerTimelineTitleLabel')}
      feature={t('customerTimelineFeature')}
      description={t('customerTimelineDescription')}
    />
  );
}
