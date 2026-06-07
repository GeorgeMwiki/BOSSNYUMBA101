'use client';

/**
 * RedeemInviteSection — redeem an invite code for a tenant identity.
 *
 * Mirrors the operator-assisted onboarding path: an operator pastes a code and
 * the target identity id, and the gateway atomically creates the membership in
 * the code's org (tenant-scoped — a code from another tenant returns 404).
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Ticket, CheckCircle2 } from 'lucide-react';
import {
  Button,
  Input,
  Alert,
  AlertDescription,
  useToast,
} from '@bossnyumba/design-system';
import {
  redeemInvite,
  type OrgMembership,
} from '@/lib/identity-api';

export function RedeemInviteSection(): JSX.Element {
  const t = useTranslations('orgInvites');
  const toast = useToast();

  const [code, setCode] = useState('');
  const [identityId, setIdentityId] = useState('');
  const [result, setResult] = useState<OrgMembership | null>(null);

  const redeem = useMutation({
    mutationFn: () =>
      redeemInvite({ code: code.trim(), tenantIdentityId: identityId.trim() }),
    onSuccess: (membership) => {
      setResult(membership);
      toast.toast({ title: t('toast_redeemed'), variant: 'success' });
      setCode('');
      setIdentityId('');
    },
    onError: (err) => {
      setResult(null);
      toast.toast({ title: (err as Error).message || t('toast_redeem_failed'), variant: 'destructive' });
    },
  });

  const canRedeem =
    code.trim().length > 0 && identityId.trim().length > 0 && !redeem.isPending;

  return (
    <section className="card p-4 space-y-4" aria-labelledby="redeem-heading">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-signal-500" aria-hidden="true" />
        <h2 id="redeem-heading" className="text-base font-semibold">
          {t('redeem_title')}
        </h2>
      </div>
      <p className="text-sm text-neutral-500">{t('redeem_desc')}</p>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canRedeem) redeem.mutate();
        }}
      >
        <div className="flex-1">
          <Input
            label={t('field_code')}
            placeholder={t('field_code_placeholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <Input
            label={t('field_identity')}
            placeholder={t('field_identity_placeholder')}
            value={identityId}
            onChange={(e) => setIdentityId(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={!canRedeem}>
          {redeem.isPending ? t('redeeming') : t('redeem')}
        </Button>
      </form>

      {redeem.error && (
        <Alert variant="danger">
          <AlertDescription>
            {(redeem.error as Error).message || t('toast_redeem_failed')}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert variant="success">
          <AlertDescription className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('redeem_success', {
              org: result.nickname || result.organizationId,
            })}
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}

export default RedeemInviteSection;
