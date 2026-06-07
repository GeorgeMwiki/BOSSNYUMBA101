'use client';

/**
 * MembershipsSection — look up an identity's org memberships and manage them.
 *
 * The gateway scopes the returned memberships to the caller's tenant, so an
 * operator only ever sees rows in their own platform tenant. Block (admin) and
 * leave are wired to the real endpoints with confirmation + toast feedback.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Users, Search } from 'lucide-react';
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
  listMemberships,
  leaveMembership,
  blockMembership,
  type OrgMembership,
  type OrgMembershipStatus,
} from '@/lib/identity-api';

function statusVariant(status: OrgMembershipStatus): 'active' | 'inactive' | 'pending' {
  if (status === 'ACTIVE') return 'active';
  if (status === 'BLOCKED') return 'inactive';
  return 'pending';
}

export function MembershipsSection(): JSX.Element {
  const t = useTranslations('orgInvites');
  const toast = useToast();
  const qc = useQueryClient();

  const [identityInput, setIdentityInput] = useState('');
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null);

  const membershipsKey = ['identity', 'memberships', activeIdentity] as const;

  const query = useQuery({
    queryKey: membershipsKey,
    queryFn: () => listMemberships(activeIdentity as string),
    enabled: Boolean(activeIdentity),
    retry: 1,
  });

  const leave = useMutation({
    mutationFn: (id: string) => leaveMembership(id),
    onSuccess: () => {
      toast.toast({ title: t('toast_left'), variant: 'success' });
      void qc.invalidateQueries({ queryKey: membershipsKey });
    },
    onError: (err) => {
      toast.toast({ title: (err as Error).message || t('toast_action_failed'), variant: 'destructive' });
    },
  });

  const block = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      blockMembership(vars.id, vars.reason),
    onSuccess: () => {
      toast.toast({ title: t('toast_blocked'), variant: 'success' });
      void qc.invalidateQueries({ queryKey: membershipsKey });
    },
    onError: (err) => {
      toast.toast({ title: (err as Error).message || t('toast_action_failed'), variant: 'destructive' });
    },
  });

  const memberships = query.data ?? [];

  return (
    <section className="card p-4 space-y-4" aria-labelledby="memberships-heading">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-signal-500" aria-hidden="true" />
        <h2 id="memberships-heading" className="text-base font-semibold">
          {t('memberships_title')}
        </h2>
      </div>
      <p className="text-sm text-neutral-500">{t('memberships_desc')}</p>

      {/* Identity lookup */}
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const id = identityInput.trim();
          if (id.length > 0) setActiveIdentity(id);
        }}
      >
        <div className="flex-1">
          <Input
            label={t('field_identity_lookup')}
            placeholder={t('field_identity_lookup_placeholder')}
            value={identityInput}
            onChange={(e) => setIdentityInput(e.target.value)}
          />
        </div>
        <Button
          type="submit"
          disabled={identityInput.trim().length === 0}
          className="flex items-center gap-1"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('look_up')}
        </Button>
      </form>

      {/* Results */}
      {!activeIdentity && (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={t('memberships_idle_title')}
          description={t('memberships_idle_desc')}
        />
      )}

      {activeIdentity && query.isLoading && (
        <div className="flex justify-center py-8">
          <Spinner size="lg" className="text-signal-500" />
        </div>
      )}

      {activeIdentity && query.error && (
        <Alert variant="danger">
          <AlertDescription className="flex items-center gap-2">
            {(query.error as Error).message || t('memberships_load_failed')}
            <Button size="sm" onClick={() => query.refetch()}>
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {activeIdentity && !query.isLoading && !query.error && memberships.length === 0 && (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={t('memberships_empty_title')}
          description={t('memberships_empty_desc')}
        />
      )}

      {memberships.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border" aria-label={t('memberships_title')}>
          {memberships.map((m: OrgMembership) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {m.nickname || m.organizationId}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {t('joined_label', {
                    date: new Date(m.joinedAt).toLocaleDateString(),
                  })}
                  {m.joinedViaInviteCode ? ` · ${m.joinedViaInviteCode}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={statusVariant(m.status)}>
                  {t(`status_${m.status}` as 'status_ACTIVE')}
                </StatusBadge>
                {m.status === 'ACTIVE' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={leave.isPending}
                      onClick={() => {
                        if (window.confirm(t('confirm_leave'))) leave.mutate(m.id);
                      }}
                    >
                      {t('leave')}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={block.isPending}
                      onClick={() => {
                        const reason = window.prompt(t('prompt_block_reason'));
                        if (reason && reason.trim().length > 0) {
                          block.mutate({ id: m.id, reason: reason.trim() });
                        }
                      }}
                    >
                      {t('block')}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MembershipsSection;
