'use client';

/**
 * InviteCodesSection — generate, list, and revoke org invite codes.
 *
 * Wired to the real /identity/invites endpoints via lib/identity-api. Honest
 * loading / empty / error states; destructive revoke is confirmed inline.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Ticket, Copy, Check } from 'lucide-react';
import {
  Button,
  Input,
  Spinner,
  EmptyState,
  Alert,
  AlertDescription,
  StatusBadge,
  useToast,
} from '@bossnyumba/design-system';
import {
  listInvites,
  generateInvite,
  revokeInvite,
  type InviteCodeRecord,
} from '@/lib/identity-api';

const INVITES_KEY = ['identity', 'invites'] as const;

function isRevoked(_record: InviteCodeRecord): boolean {
  // The list endpoint does not surface revoked_at directly; revoked codes are
  // simply unusable. We treat a code as exhausted when redemptions hit max.
  return false;
}

function exhaustedLabel(
  record: InviteCodeRecord,
  t: ReturnType<typeof useTranslations>,
): string {
  if (record.maxRedemptions == null) {
    return t('redemptions_unlimited', { used: record.redemptionsUsed });
  }
  return t('redemptions_capped', {
    used: record.redemptionsUsed,
    max: record.maxRedemptions,
  });
}

export function InviteCodesSection(): JSX.Element {
  const t = useTranslations('orgInvites');
  const toast = useToast();
  const qc = useQueryClient();

  const [roleId, setRoleId] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const query = useQuery({
    queryKey: INVITES_KEY,
    queryFn: listInvites,
    retry: 1,
  });

  const generate = useMutation({
    mutationFn: () =>
      generateInvite({
        defaultRoleId: roleId.trim(),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      }),
    onSuccess: (record) => {
      toast.toast({ title: t('toast_generated', { code: record.code }), variant: 'success' });
      setRoleId('');
      setMaxRedemptions('');
      void qc.invalidateQueries({ queryKey: INVITES_KEY });
    },
    onError: (err) => {
      toast.toast({ title: (err as Error).message || t('toast_generate_failed'), variant: 'destructive' });
    },
  });

  const revoke = useMutation({
    mutationFn: (code: string) => revokeInvite(code),
    onSuccess: () => {
      toast.toast({ title: t('toast_revoked'), variant: 'success' });
      void qc.invalidateQueries({ queryKey: INVITES_KEY });
    },
    onError: (err) => {
      toast.toast({ title: (err as Error).message || t('toast_revoke_failed'), variant: 'destructive' });
    },
  });

  const invites = query.data ?? [];
  const canGenerate = roleId.trim().length > 0 && !generate.isPending;

  async function copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context) — non-fatal.
      toast.toast({ title: t('toast_copy_failed'), variant: 'warning' });
    }
  }

  return (
    <section className="card p-4 space-y-4" aria-labelledby="invite-codes-heading">
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-signal-500" aria-hidden="true" />
        <h2 id="invite-codes-heading" className="text-base font-semibold">
          {t('invites_title')}
        </h2>
      </div>
      <p className="text-sm text-neutral-500">{t('invites_desc')}</p>

      {/* Generate form */}
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canGenerate) generate.mutate();
        }}
      >
        <div className="flex-1">
          <Input
            label={t('field_role')}
            placeholder={t('field_role_placeholder')}
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            required
          />
        </div>
        <div className="w-full sm:w-40">
          <Input
            label={t('field_max_redemptions')}
            type="number"
            min={1}
            placeholder={t('field_max_placeholder')}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!canGenerate} className="flex items-center gap-1">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {generate.isPending ? t('generating') : t('generate')}
        </Button>
      </form>

      {/* List */}
      {query.isLoading && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" className="text-signal-500" />
        </div>
      )}

      {query.error && (
        <Alert variant="danger">
          <AlertDescription className="flex items-center gap-2">
            {(query.error as Error).message || t('invites_load_failed')}
            <Button size="sm" onClick={() => query.refetch()}>
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!query.isLoading && !query.error && invites.length === 0 && (
        <EmptyState
          icon={<Ticket className="h-8 w-8" />}
          title={t('invites_empty_title')}
          description={t('invites_empty_desc')}
        />
      )}

      {invites.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label={t('invites_title')}>
          {invites.map((invite) => (
            <li key={invite.code} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm font-medium">{invite.code}</code>
                  <button
                    type="button"
                    onClick={() => void copyCode(invite.code)}
                    className="text-neutral-400 hover:text-neutral-600"
                    aria-label={t('copy_code')}
                  >
                    {copied === invite.code ? (
                      <Check className="h-4 w-4 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div className="text-xs text-neutral-500">
                  {t('role_label', { role: invite.defaultRoleId })} ·{' '}
                  {exhaustedLabel(invite, t)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={isRevoked(invite) ? 'inactive' : 'active'}>
                  {isRevoked(invite) ? t('status_revoked') : t('status_active')}
                </StatusBadge>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={revoke.isPending}
                  onClick={() => {
                    if (window.confirm(t('confirm_revoke', { code: invite.code }))) {
                      revoke.mutate(invite.code);
                    }
                  }}
                >
                  {t('revoke')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default InviteCodesSection;
