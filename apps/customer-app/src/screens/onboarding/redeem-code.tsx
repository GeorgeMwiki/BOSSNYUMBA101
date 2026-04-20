'use client';

/**
 * Redeem-Code onboarding page.
 *
 * Skeleton screen shown when a tenant wants to join a new organization
 * by entering the special code issued by that org's admin. On submit it
 * calls `useAuth().redeemInviteCode(code)` — currently a stub that will
 * become a real API call when the backend lands (see
 * `services/identity/src/invite-code.service.ts`).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Client-side invite-code shape check. Real validation happens server-side;
 * this is only to save a round-trip on obviously malformed input.
 *
 * Codes follow the loose pattern `<ORG-PREFIX>-<ALNUM>` (e.g. `ACME-A3F9`).
 * Minimum 4 chars overall so a pasted placeholder is rejected.
 */
const INVITE_CODE_REGEX = /^[A-Z0-9]{2,}-?[A-Z0-9]{2,}$/i;

export interface RedeemCodeFormState {
  readonly code: string;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly success: string | null;
}

const INITIAL_STATE: RedeemCodeFormState = {
  code: '',
  submitting: false,
  error: null,
  success: null,
};

export default function RedeemCodePage() {
  const { redeemInviteCode, user } = useAuth();
  const [state, setState] = useState<RedeemCodeFormState>(INITIAL_STATE);

  const validationMessage = useMemo<string | null>(() => {
    if (!state.code) return null;
    const trimmed = state.code.trim();
    if (trimmed.length < 4) return 'Code is too short.';
    if (!INVITE_CODE_REGEX.test(trimmed)) {
      return 'Codes look like “ACME-A3F9”. Please check and try again.';
    }
    return null;
  }, [state.code]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setState((s) => ({ ...s, code: value, error: null, success: null }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (validationMessage) {
        setState((s) => ({ ...s, error: validationMessage }));
        return;
      }
      setState((s) => ({ ...s, submitting: true, error: null, success: null }));
      const result = await redeemInviteCode(state.code.trim());
      if (!result.success) {
        setState((s) => ({
          ...s,
          submitting: false,
          error: result.message ?? 'Unable to redeem code',
        }));
        return;
      }
      setState({
        ...INITIAL_STATE,
        success: 'Organization added. You can switch to it from the header.',
      });
    },
    [redeemInviteCode, state.code, validationMessage]
  );

  const disabled =
    state.submitting || !state.code || validationMessage !== null || !user;

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">
        Join an organization
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Enter the invite code your landlord or property manager shared with
        you. One code attaches your account to their portfolio.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="invite-code"
            className="block text-sm font-medium text-gray-700"
          >
            Invite code
          </label>
          <input
            id="invite-code"
            name="invite-code"
            type="text"
            autoComplete="off"
            inputMode="text"
            spellCheck={false}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-base uppercase tracking-wider shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="ACME-A3F9"
            value={state.code}
            onChange={handleChange}
            aria-invalid={validationMessage !== null}
            aria-describedby="invite-code-help"
          />
          <p id="invite-code-help" className="mt-1 text-xs text-gray-500">
            Codes are case-insensitive. We&apos;ll verify it instantly.
          </p>
          {validationMessage && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {validationMessage}
            </p>
          )}
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-green-700">
            {state.success}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled}
          className="inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.submitting ? 'Redeeming…' : 'Redeem code'}
        </button>
      </form>
    </main>
  );
}
