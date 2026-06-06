import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

// The form reads `?next=` from the URL; force-dynamic so Next does not try
// to statically prerender a page that depends on request-time search params.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
