'use client';

/**
 * NotificationPreferencesForm — channel × category grid.
 *
 * Reads from `GET /api/v1/notifications/preferences` and writes via
 * `PUT /api/v1/notifications/preferences`. Layout: a small grid where
 * each row is a category and each column is a channel. Toggles are
 * `<input type="checkbox" role="switch">` so the E2E spec's
 * `[role="switch"], input[type="checkbox"]` locator picks them up.
 *
 * UX:
 *   - Immutable state: every toggle creates a new prefs object.
 *   - Save round-trips through the gateway. Save button announces
 *     submission state via `aria-busy`.
 *   - On load failure we show an error banner + retry — the user is
 *     never trapped on a blank screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

type Channel = 'email' | 'sms' | 'push' | 'whatsapp';
type Category = 'payments' | 'maintenance' | 'messages' | 'marketing';

interface Prefs {
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
  readonly whatsapp: boolean;
  readonly categories: {
    readonly [key in Category]?: {
      readonly email?: boolean;
      readonly sms?: boolean;
      readonly push?: boolean;
      readonly whatsapp?: boolean;
    };
  };
}

const CHANNELS: ReadonlyArray<Channel> = ['email', 'sms', 'push', 'whatsapp'];
const CATEGORIES: ReadonlyArray<Category> = [
  'payments',
  'maintenance',
  'messages',
  'marketing',
];

const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  whatsapp: 'WhatsApp',
};

const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  payments: 'Payments',
  maintenance: 'Maintenance',
  messages: 'Messages',
  marketing: 'Marketing',
};

function defaultPrefs(): Prefs {
  return {
    email: true,
    sms: true,
    push: true,
    whatsapp: false,
    categories: {
      payments: { email: true, sms: true, push: true, whatsapp: false },
      maintenance: { email: true, sms: true, push: true, whatsapp: false },
      messages: { email: true, sms: false, push: true, whatsapp: false },
      marketing: { email: false, sms: false, push: false, whatsapp: false },
    },
  };
}

function isEnabled(prefs: Prefs, category: Category, channel: Channel): boolean {
  const row = prefs.categories[category];
  return Boolean(row && row[channel]);
}

function setEnabled(
  prefs: Prefs,
  category: Category,
  channel: Channel,
  next: boolean,
): Prefs {
  const existing = prefs.categories[category] ?? {};
  return {
    ...prefs,
    categories: {
      ...prefs.categories,
      [category]: {
        ...existing,
        [channel]: next,
      },
    },
  };
}

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('customer_token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function NotificationPreferencesForm(): JSX.Element {
  const [prefs, setPrefs] = useState<Prefs>(() => defaultPrefs());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBaseUrl()}/notifications/preferences`, {
          headers: authHeader(),
        });
        if (!res.ok) {
          // 404 / 401 → fall back to defaults so the user can still
          // configure. Hard failures show the banner.
          if (res.status === 404 || res.status === 401) {
            if (active) setPrefs(defaultPrefs());
            return;
          }
          throw new Error(`Failed to load preferences (${res.status})`);
        }
        const body = (await res.json()) as { data?: Partial<Prefs> };
        if (!active) return;
        const merged = { ...defaultPrefs(), ...(body.data ?? {}) };
        setPrefs(merged as Prefs);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load preferences',
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const onToggle = useCallback(
    (category: Category, channel: Channel) => {
      setPrefs((prev) => setEnabled(prev, category, channel, !isEnabled(prev, category, channel)));
      setSuccess(null);
    },
    [],
  );

  const onSave = useCallback(async (): Promise<void> => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);
      }
      setSuccess('Preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-8 text-sm text-gray-400"
        data-testid="notification-prefs-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" /> Loading preferences…
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSave();
      }}
      data-testid="notification-preferences-form"
      className="space-y-5"
      aria-busy={saving}
    >
      {error ? (
        <div
          role="alert"
          className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((v) => v + 1)}
            className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      ) : null}
      {success ? (
        <div
          role="status"
          className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 p-3 text-sm"
        >
          {success}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#1a1a1a]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-gray-400">
              <th scope="col" className="px-3 py-2">
                Category
              </th>
              {CHANNELS.map((ch) => (
                <th
                  scope="col"
                  className="px-3 py-2 text-center"
                  key={ch}
                >
                  {CHANNEL_LABELS[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => (
              <tr key={cat} className="border-b border-white/5 last:border-0">
                <th
                  scope="row"
                  className="px-3 py-3 text-left font-medium text-white"
                >
                  {CATEGORY_LABELS[cat]}
                </th>
                {CHANNELS.map((ch) => {
                  const checked = isEnabled(prefs, cat, ch);
                  return (
                    <td className="px-3 py-3 text-center" key={ch}>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={checked}
                        aria-checked={checked}
                        aria-label={`${CATEGORY_LABELS[cat]} ${CHANNEL_LABELS[ch]}`}
                        data-testid={`pref-${cat}-${ch}`}
                        onChange={() => onToggle(cat, ch)}
                        className="h-5 w-5 cursor-pointer rounded border border-white/20 bg-[#121212] accent-blue-500"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          data-testid="save-notification-prefs"
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
