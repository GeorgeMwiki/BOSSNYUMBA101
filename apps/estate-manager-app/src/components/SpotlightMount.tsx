'use client';

import { useRouter } from 'next/navigation';
import { Spotlight } from '@bossnyumba/spotlight/react';
import { ROUTES } from '@/lib/routes';

export function SpotlightMount(): JSX.Element {
  const router = useRouter();
  return (
    <Spotlight
      userRoles={['MANAGER']}
      onAction={(action) => {
        if (action.route) router.push(action.route);
      }}
      onPersonaHandoff={(query) => {
        router.push(ROUTES.brain.withQuery(query));
      }}
    />
  );
}
