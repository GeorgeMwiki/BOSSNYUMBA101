import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Alert,
  AlertDescription,
  Button,
  Badge,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface TenantDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly status: string;
  readonly contactEmail: string;
  readonly contactPhone?: string;
  readonly createdAt?: string;
}

interface TenantSettings {
  readonly timezone?: string;
  readonly currency?: string;
  readonly locale?: string;
  readonly features?: ReadonlyArray<string>;
}

interface TenantSubscription {
  readonly plan: string;
  readonly status: string;
  readonly maxUnits?: number;
  readonly maxUsers?: number;
  readonly currentPeriodEndsAt?: string;
}

interface TenantSnapshot {
  readonly tenant: TenantDetail;
  readonly settings: TenantSettings | null;
  readonly subscription: TenantSubscription | null;
}

export function TenantManagementPage() {
  const t = useTranslations('pages');
  const { tenant: authTenant } = useAuth();
  const [snapshot, setSnapshot] = useState<TenantSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [tenantRes, settingsRes, subRes] = await Promise.all([
        api.get<TenantDetail>('/tenants/current'),
        api.get<TenantSettings>('/tenants/current/settings'),
        api.get<TenantSubscription>('/tenants/current/subscription'),
      ]);
      if (signal?.aborted) return;
      if (!tenantRes.success || !tenantRes.data) {
        setError(tenantRes.error?.message ?? 'Failed to load tenant');
        setLoading(false);
        return;
      }
      setSnapshot({
        tenant: tenantRes.data,
        settings: settingsRes.success ? settingsRes.data ?? null : null,
        subscription: subRes.success ? subRes.data ?? null : null,
      });
      setLoading(false);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error}
          <Button
            size="sm"
            onClick={() => void load()}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Fall back to the auth-context tenant if the dedicated endpoint did not
  // return a payload — auth/me already supplies the basic tenant identity.
  const tenant: TenantDetail | null =
    snapshot?.tenant ??
    (authTenant
      ? {
          id: authTenant.id,
          name: authTenant.name,
          slug: authTenant.slug,
          status: 'active',
          contactEmail: '',
        }
      : null);

  if (!tenant) {
    return null;
  }

  const settings = snapshot?.settings ?? null;
  const subscription = snapshot?.subscription ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('tenantManagementTitle')}</h1>
        <p className="text-gray-500">{t('tenantManagementFeature')}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{tenant.name}</CardTitle>
            <Badge>{tenant.status}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Slug</dt>
              <dd className="font-medium text-gray-900">{tenant.slug}</dd>
            </div>
            {tenant.contactEmail ? (
              <div>
                <dt className="text-gray-500">Contact email</dt>
                <dd className="font-medium text-gray-900">{tenant.contactEmail}</dd>
              </div>
            ) : null}
            {tenant.contactPhone ? (
              <div>
                <dt className="text-gray-500">Contact phone</dt>
                <dd className="font-medium text-gray-900">{tenant.contactPhone}</dd>
              </div>
            ) : null}
            {tenant.createdAt ? (
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">{tenant.createdAt}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {settings ? (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {settings.timezone ? (
                <div>
                  <dt className="text-gray-500">Timezone</dt>
                  <dd className="font-medium text-gray-900">{settings.timezone}</dd>
                </div>
              ) : null}
              {settings.currency ? (
                <div>
                  <dt className="text-gray-500">Currency</dt>
                  <dd className="font-medium text-gray-900">{settings.currency}</dd>
                </div>
              ) : null}
              {settings.locale ? (
                <div>
                  <dt className="text-gray-500">Locale</dt>
                  <dd className="font-medium text-gray-900">{settings.locale}</dd>
                </div>
              ) : null}
            </dl>
            {settings.features && settings.features.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-1">Features</p>
                <div className="flex flex-wrap gap-2">
                  {settings.features.map((f) => (
                    <Badge key={f}>{f}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {subscription ? (
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Plan</dt>
                <dd className="font-medium text-gray-900">{subscription.plan}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900">{subscription.status}</dd>
              </div>
              {typeof subscription.maxUnits === 'number' ? (
                <div>
                  <dt className="text-gray-500">Max units</dt>
                  <dd className="font-medium text-gray-900">{subscription.maxUnits}</dd>
                </div>
              ) : null}
              {typeof subscription.maxUsers === 'number' ? (
                <div>
                  <dt className="text-gray-500">Max users</dt>
                  <dd className="font-medium text-gray-900">{subscription.maxUsers}</dd>
                </div>
              ) : null}
              {subscription.currentPeriodEndsAt ? (
                <div>
                  <dt className="text-gray-500">Current period ends</dt>
                  <dd className="font-medium text-gray-900">{subscription.currentPeriodEndsAt}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
