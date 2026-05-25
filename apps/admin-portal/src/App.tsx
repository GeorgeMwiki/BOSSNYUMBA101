/**
 * apps/admin-portal — DEPRECATED.
 *
 * This Vite app is being retired. All HQ-flavoured pages have moved
 * to `apps/admin-platform-portal/` (BossNyumba HQ); all agency-admin
 * pages have moved to `apps/owner-portal/` (the consolidated owner +
 * agency-admin portal — owners ARE the admins). See
 * `apps/admin-portal/DEPRECATED.md` and
 * `.planning/jarvis-architecture.md` Section 1.
 *
 * This shell is reduced to a single landing component that explains
 * where to go. The build still succeeds so existing infrastructure
 * pointing at port 3000 doesn't fail; visitors are redirected.
 */

import React from 'react';

interface ViteImportMeta {
  readonly env?: {
    readonly VITE_PLATFORM_PORTAL_URL?: string;
    readonly VITE_OWNER_PORTAL_URL?: string;
  };
}
const viteMeta = import.meta as unknown as ViteImportMeta;
const PLATFORM_PORTAL_URL =
  viteMeta.env?.VITE_PLATFORM_PORTAL_URL ?? 'http://localhost:3020';
const OWNER_PORTAL_URL =
  viteMeta.env?.VITE_OWNER_PORTAL_URL ?? 'http://localhost:3001';

export default function App(): JSX.Element {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          This app has moved
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          BossNyumba consolidated to a 4-portal model. The admin portal you were
          looking at has been split into two destinations:
        </p>
        <div className="mt-6 space-y-4">
          <a
            href={OWNER_PORTAL_URL}
            className="block rounded border border-orange-200 bg-orange-50 px-4 py-3 hover:bg-orange-100"
          >
            <div className="font-medium text-orange-900">Owner portal →</div>
            <p className="mt-1 text-sm text-orange-800">
              Agency administration (tenants, billing, users, roles, audit log,
              compliance, integrations, communications, analytics, classroom,
              support, head-of-estates dashboard). Owners are the admins; this
              is where you administer your business and invite admin sub-users.
            </p>
          </a>
          <a
            href={PLATFORM_PORTAL_URL}
            className="block rounded border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100"
          >
            <div className="font-medium text-blue-900">
              BossNyumba HQ portal →
            </div>
            <p className="mt-1 text-sm text-blue-800">
              Platform-internal tools (AI costs, system health, feature flags,
              data privacy, warehouse, webhook DLQ, control tower, legacy
              migration, platform overview / billing / subscriptions /
              feature-flags). For BossNyumba staff only.
            </p>
          </a>
        </div>
        <p className="mt-6 text-xs text-gray-500">
          Reference: <code>apps/admin-portal/DEPRECATED.md</code> —
          page-by-page migration manifest.
        </p>
      </div>
    </main>
  );
}
