'use client';

import { useRouter } from 'next/navigation';
import { Spotlight } from '@bossnyumba/spotlight/react';

export function SpotlightMount(): JSX.Element {
  const router = useRouter();
  return (
    <Spotlight
      userRoles={['MANAGER']}
      onAction={(action) => {
        if (action.route) router.push(action.route);
      }}
      onPersonaHandoff={(query) => {
        router.push(`/brain?q=${encodeURIComponent(query)}`);
      }}
    />
  );
}
