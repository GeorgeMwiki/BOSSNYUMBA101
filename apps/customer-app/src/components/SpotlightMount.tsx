'use client';

import { useRouter } from 'next/navigation';
import { Spotlight } from '@bossnyumba/spotlight/react';

/**
 * Spotlight mount for customer-app. Bound to Next.js router for navigation.
 * Roles are pulled from the future auth context; for now we default to
 * TENANT which is appropriate for customer-app.
 */
export function SpotlightMount(): JSX.Element {
  const router = useRouter();
  return (
    <Spotlight
      userRoles={['TENANT']}
      onAction={(action) => {
        if (action.route) router.push(action.route);
      }}
      onPersonaHandoff={(query) => {
        router.push(`/assistant?q=${encodeURIComponent(query)}`);
      }}
    />
  );
}
