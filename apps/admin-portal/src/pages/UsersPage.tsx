import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function UsersPage() {
  return (
    <LiveDataRequiredPage
      title="Users"
      feature="user directory data"
      description="This screen will return once the live identity and admin user-management APIs are connected."
    />
  );
}
