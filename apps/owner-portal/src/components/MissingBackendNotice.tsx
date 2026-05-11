import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MissingBackendNoticeProps {
  readonly title: string;
  readonly endpoint: string;
  readonly description?: string;
}

/**
 * MissingBackendNotice — successor to LiveDataRequiredPage that surfaces
 * the *concrete* missing endpoint name so operators and engineers can
 * track precisely which gateway route still needs to land before the
 * page can render real data. No sample data, no placeholder rows.
 */
export function MissingBackendNotice({
  title,
  endpoint,
  description,
}: MissingBackendNoticeProps) {
  const t = useTranslations('liveData');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500">{t('requiredBanner')}</p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-900">
              {title} {t('unavailableSuffix')}
            </h2>
            {description ? (
              <p className="text-sm text-red-800">{description}</p>
            ) : null}
            <p className="text-xs font-mono text-red-900 bg-red-100 rounded px-2 py-1 inline-block">
              {endpoint}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
