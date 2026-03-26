import { AlertTriangle } from 'lucide-react';

interface LiveDataRequiredPageProps {
  title: string;
  feature: string;
  description?: string;
}

export function LiveDataRequiredPage({
  title,
  feature,
  description,
}: LiveDataRequiredPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500">Live operational data is required for this view.</p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-900">{feature} unavailable</h2>
            <p className="text-sm text-red-800">
              {description ??
                `${feature} data is not yet available. This view requires a configured ${feature.toLowerCase()} integration to display live data.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
