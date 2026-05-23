/**
 * useFeatureFlag — React hook wrapper around `isFeatureEnabled`.
 *
 * Reactive: subscribes to `popstate` so when the QA tester edits the
 * URL by hand the gated UI updates without a refresh.
 */
import { useEffect, useState } from 'react';
import { isFeatureEnabled, type OwnerFeatureFlag } from './featureFlags';

export function useFeatureFlag(name: OwnerFeatureFlag): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(name));

  useEffect(() => {
    function recompute(): void {
      setEnabled(isFeatureEnabled(name));
    }
    window.addEventListener('popstate', recompute);
    return () => window.removeEventListener('popstate', recompute);
  }, [name]);

  return enabled;
}
