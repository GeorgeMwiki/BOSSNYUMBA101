/**
 * OwnerForgotPasswordForm live-detector tests (blocker #H31).
 *
 * Proves the password-recovery form is a REAL backend call, not a stub:
 *  - submitting a valid email invokes `supabase.auth.resetPasswordForEmail`
 *    with that email and a `redirectTo` that lands on the owner cockpit;
 *  - a clean Supabase response renders the honest, enumeration-safe
 *    "check your email" panel;
 *  - a Supabase error surfaces inline (no silent no-op);
 *  - an invalid email is blocked client-side and never reaches Supabase.
 *
 * The Supabase browser client is mocked so the test never touches real
 * env or network — the assertions are on the call shape and the rendered
 * honest states. Uses `fireEvent` (from @testing-library/react, a
 * declared dep) rather than user-event to avoid a phantom dependency.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const resetPasswordForEmail = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

import { OwnerForgotPasswordForm } from '../OwnerForgotPasswordForm';

function submitEmail(value: string): void {
  fireEvent.change(screen.getByTestId('owner-forgot-email'), {
    target: { value },
  });
  fireEvent.submit(screen.getByTestId('owner-forgot-form'));
}

beforeEach(() => {
  resetPasswordForEmail.mockReset();
});

describe('OwnerForgotPasswordForm — real resetPasswordForEmail wiring', () => {
  it('calls supabase.auth.resetPasswordForEmail with the email + a cockpit redirectTo', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<OwnerForgotPasswordForm locale="en" />);

    submitEmail('owner@example.com');

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledTimes(1));
    const [email, opts] = resetPasswordForEmail.mock.calls[0];
    expect(email).toBe('owner@example.com');
    expect(opts).toMatchObject({ redirectTo: expect.stringContaining('/sign-in') });
  });

  it('renders the honest enumeration-safe "sent" panel on a clean response', async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<OwnerForgotPasswordForm locale="en" />);

    submitEmail('owner@example.com');

    expect(await screen.findByTestId('owner-forgot-sent')).toBeInTheDocument();
    expect(screen.getByText('Check your email.')).toBeInTheDocument();
    // The raw form is replaced by the success panel.
    expect(screen.queryByTestId('owner-forgot-form')).toBeNull();
  });

  it('surfaces a Supabase error inline (no silent no-op)', async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'rate limit exceeded' },
    });
    render(<OwnerForgotPasswordForm locale="en" />);

    submitEmail('owner@example.com');

    expect(await screen.findByTestId('owner-forgot-error')).toHaveTextContent(
      'rate limit exceeded',
    );
    // Never falsely claims success on an error.
    expect(screen.queryByTestId('owner-forgot-sent')).toBeNull();
  });

  it('blocks an invalid email client-side and never calls Supabase', async () => {
    render(<OwnerForgotPasswordForm locale="en" />);

    submitEmail('not-an-email');

    expect(await screen.findByTestId('owner-forgot-error')).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('renders pure Swahili copy with no English leakage when locale=sw', () => {
    render(<OwnerForgotPasswordForm locale="sw" />);
    expect(screen.getByTestId('owner-forgot-submit')).toHaveTextContent(
      'Tuma kiungo cha kuweka upya',
    );
    expect(screen.queryByText('Send reset link')).toBeNull();
  });
});
