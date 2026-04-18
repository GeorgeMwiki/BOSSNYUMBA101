'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Alert, AlertDescription } from '@bossnyumba/design-system';

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

const labels: Record<Category, string> = {
  rentReminders: 'Rent reminders',
  maintenanceUpdates: 'Maintenance updates',
  announcements: 'Building announcements',
  marketing: 'Marketing / promotions',
  emergencies: 'Emergencies',
};

export default function NotificationSettingsPage(): React.ReactElement {
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaults);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // TODO: wire GET /api/customer/settings/notifications
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/settings/notifications');
        if (!cancelled && res.ok) setPrefs((await res.json()) as NotificationPreferences);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (cat: Category, channel: Channel): void => {
    // Immutable nested update
    setPrefs((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], [channel]: !prev[cat][channel] },
    }));
  };

  const save = async (): Promise<void> => {
    try {
      // TODO: wire PUT /api/customer/settings/notifications
      const res = await fetch('/api/customer/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      setMessage(res.ok ? 'Preferences saved.' : 'Save failed.');
    } catch {
      setMessage('Save failed.');
    }
  };

  const categories = Object.keys(prefs) as ReadonlyArray<Category>;

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Notification preferences</h1>
      {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Channels per category</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2"></th>
                <th className="p-2">Email</th>
                <th className="p-2">SMS</th>
                <th className="p-2">Push</th>
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
                        aria-label={`${labels[cat]} ${ch}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Button className="mt-4" onClick={save}>Save preferences</Button>
        </CardContent>
      </Card>
    </main>
  );
}
