/**
 * /forgot-password page wiring test (blocker #H31).
 *
 * The sign-in "Forgot your password?" link previously pointed to
 * `/sign-in/forgot`, which 404'd — password recovery was unreachable.
 * The fix adds this route, which mounts the real
 * `<OwnerForgotPasswordForm>` client component that calls
 * `supabase.auth.resetPasswordForEmail`.
 *
 * These tests are the live detector that the recovery page exists and is
 * wired to the real form (not a placeholder / 404). The async server
 * component reads the locale cookie via `next/headers`, so we mock
 * `next/headers` and the Supabase browser client, then await the
 * component to a React element before handing it to RTL.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/headers', () => ({
  // Default render resolves to the English locale (no cookie set).
  cookies: () => Promise.resolve({ get: () => undefined }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { resetPasswordForEmail: vi.fn() },
  }),
}));

import ForgotPasswordPage from '../page';

async function renderForgotPage(): Promise<void> {
  // Async server component → resolve to an element before mounting.
  const ui = await ForgotPasswordPage();
  render(ui);
}

describe('/forgot-password page — real form wiring (blocker #H31)', () => {
  it('mounts the real OwnerForgotPasswordForm with an email field + submit', async () => {
    await renderForgotPage();
    expect(screen.getByTestId('owner-forgot-form')).toBeInTheDocument();
    expect(screen.getByTestId('owner-forgot-email')).toBeInTheDocument();
    expect(screen.getByTestId('owner-forgot-submit')).toBeInTheDocument();
  });

  it('renders the back-to-sign-in cross-link so the funnel stays navigable', async () => {
    await renderForgotPage();
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/sign-in')).toBe(true);
  });

  it('ships no dead native form-action POST funnel', async () => {
    const { container } = render(await ForgotPasswordPage());
    expect(container.querySelector('form[action]')).toBeNull();
  });

  it('renders pure English copy when no locale cookie is set', async () => {
    await renderForgotPage();
    expect(screen.getByText('Reset your password.')).toBeInTheDocument();
    // No Swahili leakage on the English render.
    expect(screen.queryByText(/Weka upya/)).toBeNull();
  });
});

describe('/forgot-password page — Swahili render is single-locale', () => {
  it('renders pure Swahili copy with the sw cookie and no English leakage', async () => {
    vi.resetModules();
    vi.doMock('next/headers', () => ({
      cookies: () =>
        Promise.resolve({
          get: (name: string) =>
            name === 'bossnyumba_locale' ? { value: 'sw' } : undefined,
        }),
    }));
    vi.doMock('@/lib/supabase/client', () => ({
      createSupabaseBrowserClient: () => ({
        auth: { resetPasswordForEmail: vi.fn() },
      }),
    }));
    const mod = await import('../page');
    render(await mod.default());
    expect(screen.getByText('Weka upya nenosiri lako.')).toBeInTheDocument();
    expect(screen.queryByText('Reset your password.')).toBeNull();
  });
});
