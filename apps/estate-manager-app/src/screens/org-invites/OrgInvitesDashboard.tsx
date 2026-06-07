'use client';

/**
 * OrgInvitesDashboard — the operator "Org & Invites" surface (#12).
 *
 * Composes three live sections backed by the /identity routes:
 *   1. Invite codes — generate / list / revoke.
 *   2. Redeem invite — operator-assisted code redemption.
 *   3. Memberships — look up an identity and block / leave its memberships.
 *
 * All data is tenant-scoped server-side from the Supabase bearer; the client
 * never sends a tenantId.
 */

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { InviteCodesSection } from './InviteCodesSection';
import { RedeemInviteSection } from './RedeemInviteSection';
import { MembershipsSection } from './MembershipsSection';

export default function OrgInvitesDashboard(): JSX.Element {
  const t = useTranslations('orgInvites');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-4">
        <InviteCodesSection />
        <RedeemInviteSection />
        <MembershipsSection />
      </div>
    </>
  );
}
