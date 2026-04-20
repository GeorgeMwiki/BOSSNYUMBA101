'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Alert,
  AlertDescription,
  Skeleton,
} from '@bossnyumba/design-system';

interface NotificationPreferences {
  readonly rentReminders: { email: boolean; sms: boolean; push: boolean };
  readonly maintenanceUpdates: { email: boolean; sms: boolean; push: boolean };
  readonly announcements: { email: boolean; sms: boolean; push: boolean };
  readonly marketing: { email: boolean; sms: boolean; push: boolean };
  readonly emergencies: { email: boolean; sms: boolean; push: boolean };
}

type Channel = 'email' | 'sms' | 'push';
type Category = keyof NotificationPreferences;

const defaults: NotificationPreferences = {
  rentReminders: { email: true, sms: true, push: true },
  maintenanceUpdates: { email: true, sms: false, push: true },
  announcements: { email: true, sms: false, push: true },
  marketing: { email: false, sms: false, push: false },
  emergencies: { email: true, sms: true, push: true },
};

export default function NotificationSettingsPage(): React.ReactElement {
  const t = useTranslations('notificationSettings');
  const labels: Record<Category, string> = {
    rentReminders: t('labels.rentReminders'),
    maintenanceUpdates: t('labels.maintenanceUpdates'),
    announcements: t('labels.announcements'),
    marketing: t('labels.marketing'),
    emergencies: t('labels.emergencies'),
  };
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaults);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(null);
    try {
      // TODO: wire GET /api/customer/settings/notifications
      const res = await fetch('/api/customer/settings/notifications', { signal });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as NotificationPreferences;
      if (!signal?.aborted) {
        setPrefs(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setLoadError(err instanceof Error ? err.message : 'Failed to load preferences');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const toggle = useCallback((cat: Category, channel: Channel): void => {
    // Immutable nested update
    setPrefs((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], [channel]: !prev[cat][channel] },
    }));
  }, []);

  const save = useCallback(async (): Promise<void> => {
    setSaving(true);
    setFeedback(null);
    try {
      // TODO: wire PUT /api/customer/settings/notifications
      const res = await fetch('/api/customer/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setFeedback({ kind: 'success', message: 'Preferences saved.' });
    } catch (err) {
      setFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  const categories = Object.keys(prefs) as ReadonlyArray<Category>;

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {loadError && (
        <Alert variant="danger">
          <AlertDescription>
            {loadError}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {feedback && (
        <Alert variant={feedback.kind === 'success' ? 'success' : 'danger'}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('channelsPerCategory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-live="polite">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="p-2"><span className="sr-only">{t('categoryHeader')}</span></th>
                    <th scope="col" className="p-2">{t('emailHeader')}</th>
                    <th scope="col" className="p-2">SMS</th>
                    <th scope="col" className="p-2">{t('pushHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat} className="border-t">
                      <td className="p-2 font-medium">{labels[cat]}</td>
                      {(['email', 'sms', 'push'] as ReadonlyArray<Channel>).map((ch) => (
                        <td key={ch} className="p-2">
                          <input
                            type="checkbox"
                            checked={prefs[cat][ch]}
                            onChange={() => toggle(cat, ch)}
                            disabled={saving}
                            aria-label={`${labels[cat]} via ${ch}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button
                className="mt-4"
                onClick={save}
                loading={saving}
                disabled={saving}
                aria-label={t('savePreferencesAria')}
              >
                {t('savePreferences')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
