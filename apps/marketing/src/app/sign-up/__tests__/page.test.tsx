/**
 * /sign-up page wiring test.
 *
 * Blocker #5 (marketing sign-up funnel 404): the page shipped a raw
 * `<form action="/api/v1/auth/sign-up" method="post">` that POSTs to a gateway
 * endpoint which does not exist — every sign-up navigated to a not-found page
 * and no account was created. The fix mounts the real `<OwnerSignUpForm>` client
 * component, which POSTs to the now-built `/api/v1/orgs/signup` route (creates
 * the Supabase auth user + tenant/org/owner + a session and sets the
 * bossnyumba-session cookie). These tests are the live detector that the funnel
 * is wired to the real form and NOT the dead raw POST form.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword: vi.fn() } }),
}));

import SignUpPage from '../page';

async function renderSignUpPage(): Promise<void> {
  const ui = await SignUpPage();
  render(ui);
}

describe('/sign-up page — real form wiring (blocker #5)', () => {
  it('mounts the real OwnerSignUpForm component', async () => {
    await renderSignUpPage();
    expect(screen.getByTestId('owner-signup-form')).toBeInTheDocument();
    expect(screen.getByTestId('owner-signup-orgname')).toBeInTheDocument();
    expect(screen.getByTestId('owner-signup-email')).toBeInTheDocument();
    expect(screen.getByTestId('owner-signup-password')).toBeInTheDocument();
  });

  it('does NOT ship the dead raw <form action="/api/v1/auth/sign-up"> funnel', async () => {
    const { container } = render(await SignUpPage());
    expect(
      container.querySelector('form[action="/api/v1/auth/sign-up"]'),
    ).toBeNull();
    // No native form-action POST funnel at all on this page.
    expect(container.querySelector('form[action]')).toBeNull();
  });
});
