import { useNavigate } from 'react-router-dom';
import { Spotlight } from '@bossnyumba/spotlight/react';
import { ROUTES } from '../lib/routes';

export function SpotlightMount(): JSX.Element {
  const navigate = useNavigate();
  return (
    <Spotlight
      userRoles={['OWNER']}
      onAction={(action) => {
        if (action.route) navigate(action.route);
      }}
      onPersonaHandoff={(query) => {
        navigate(ROUTES.portfolio.askWithQuery(query));
      }}
    />
  );
}
