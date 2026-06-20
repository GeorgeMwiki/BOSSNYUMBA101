/**
 * /sign-in page wiring test.
 *
 * Blocker #6 (marketing auth funnel 404): the page previously shipped a
 * raw `<form action="/api/v1/auth/sign-in" method="post">` that POSTs to
 * a gateway endpoint which does not exist — every login navigated to a
 * not-found page and no session was created.
 *
 * The fix mounts the real `<OwnerSignInForm>` client component, which
 * authenticates via `supabase.auth.signInWithPassword`. These tests are
 * the live detector that the funnel is wired to the real form and NOT
 * the dead raw POST form.
 *
 * Server-component rendering: `SignInPage` is an async component that
 * reads the locale cookie via `next/headers`. We mock `next/headers`,
 * `next/navigation` (the form reads `useSearchParams`), and the Supabase
 * browser client (so importing the form never touches real env), then
 * await the component to a React element before handing it to RTL.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  // Default render resolves to the English locale (no cookie set).
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: vi.fn() },
  }),
}));

import SignInPage from '../page';

async function renderSignInPage(): Promise<void> {
  // Async server component → resolve to an element before mounting.
  const ui = await SignInPage();
  render(ui);
}

describe('/sign-in page — real form wiring (blocker #6)', () => {
  it('mounts the real OwnerSignInForm component', async () => {
    await renderSignInPage();
    expect(screen.getByTestId('owner-signin-form')).toBeInTheDocument();
    expect(screen.getByTestId('owner-signin-email')).toBeInTheDocument();
    expect(screen.getByTestId('owner-signin-password')).toBeInTheDocument();
    expect(screen.getByTestId('owner-signin-submit')).toBeInTheDocument();
  });

  it('does NOT ship the dead raw <form action="/api/v1/auth/sign-in"> funnel', async () => {
    const { container } = render(await SignInPage());
    const deadForm = container.querySelector(
      'form[action="/api/v1/auth/sign-in"]',
    );
    expect(deadForm).toBeNull();
    // No native form-action POST funnel at all on this page.
    expect(container.querySelector('form[action]')).toBeNull();
  });

  it('still renders the sign-up cross-link so the funnel stays navigable', async () => {
    await renderSignInPage();
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/sign-up')).toBe(true);
  });

  it('points the "Forgot?" link at the real /forgot-password route (blocker #H31 — not the dead /sign-in/forgot)', async () => {
    await renderSignInPage();
    const forgot = screen.getByTestId('signin-forgot-link');
    expect(forgot).toHaveAttribute('href', '/forgot-password');
    // The dead destination must be gone entirely.
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/sign-in/forgot')).toBe(
      false,
    );
  });
});
