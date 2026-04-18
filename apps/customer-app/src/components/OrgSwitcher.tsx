'use client';

/**
 * OrgSwitcher — header dropdown that lists the current tenant identity's
 * organizations and lets them switch the active-org scope or add a new
 * organization by redeeming an invite code.
 *
 * Skeleton — the dropdown UI is functional but network-bound actions
 * (`setActiveOrg`, navigation to redeem-code page) wire through the
 * AuthContext stubs and will become real once the backend lands.
 */

import React, { useState, useCallback } from 'react';
import { useAuth, type CustomerOrgMembership } from '../contexts/AuthContext';

export interface OrgSwitcherProps {
  /** Called after navigation-style actions so parent can close menus. */
  onAddOrganization?: () => void;
}

export function OrgSwitcher({ onAddOrganization }: OrgSwitcherProps) {
  const { user, setActiveOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberships: CustomerOrgMembership[] = user?.memberships ?? [];
  const active = memberships.find((m) => m.organizationId === user?.activeOrgId);

  const handleSelect = useCallback(
    async (orgId: string) => {
      setSwitching(true);
      setError(null);
      const result = await setActiveOrg(orgId);
      setSwitching(false);
      if (!result.success) {
        setError(result.message ?? 'Unable to switch organization');
        return;
      }
      setOpen(false);
    },
    [setActiveOrg]
  );

  if (!user) return null;

  const label = active?.nickname ?? active?.organizationId ?? 'Select organization';

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
      >
        <span className="max-w-[12rem] truncate">{label}</span>
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none"
        >
          <ul className="max-h-72 overflow-auto py-1">
            {memberships.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">
                You haven&apos;t joined any organizations yet.
              </li>
            )}
            {memberships.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={m.organizationId === user.activeOrgId}
                  disabled={m.status !== 'ACTIVE' || switching}
                  onClick={() => handleSelect(m.organizationId)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">
                    {m.nickname ?? m.organizationId}
                  </span>
                  {m.status !== 'ACTIVE' && (
                    <span className="ml-2 text-xs uppercase text-gray-400">
                      {m.status}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200">
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
              onClick={() => {
                setOpen(false);
                onAddOrganization?.();
                // TODO: next/navigation router.push('/onboarding/redeem-code')
              }}
            >
              + Add organization (enter invite code)
            </button>
          </div>
          {error && (
            <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default OrgSwitcher;
