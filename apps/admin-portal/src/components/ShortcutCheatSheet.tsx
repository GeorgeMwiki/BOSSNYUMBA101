/**
 * Keyboard shortcut cheat sheet modal — opens on `?` key press.
 *
 * Lists every Cmd+K action + common navigation shortcuts. Readonly data
 * (immutable pattern) — no mutation, just a rendered list.
 */

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface Shortcut {
  readonly keys: readonly string[];
  readonly description: string;
}

interface ShortcutGroup {
  readonly heading: string;
  readonly items: readonly Shortcut[];
}

function buildShortcutGroups(t: (k: string) => string): readonly ShortcutGroup[] {
  return [
    {
      heading: t('groups.global'),
      items: [
        { keys: ['?'], description: t('shortcuts.openCheat') },
        { keys: ['Cmd', 'K'], description: t('shortcuts.openSpotlight') },
        { keys: ['Esc'], description: t('shortcuts.closeDialog') },
        { keys: ['G', 'H'], description: t('shortcuts.goHome') },
      ],
    },
    {
      heading: t('groups.navigation'),
      items: [
        { keys: ['G', 'T'], description: t('shortcuts.goTenants') },
        { keys: ['G', 'O'], description: t('shortcuts.goOperations') },
        { keys: ['G', 'E'], description: t('shortcuts.goExceptions') },
        { keys: ['G', 'A'], description: t('shortcuts.goAi') },
        { keys: ['G', 'R'], description: t('shortcuts.goReports') },
      ],
    },
    {
      heading: t('groups.actions'),
      items: [
        { keys: ['N', 'T'], description: t('shortcuts.newTenant') },
        { keys: ['N', 'C'], description: t('shortcuts.newCase') },
        { keys: ['/',], description: t('shortcuts.focusSearch') },
      ],
    },
  ];
}

export function ShortcutCheatSheet(): JSX.Element | null {
  const t = useTranslations('shortcutCheatSheet');
  const SHORTCUT_GROUPS = buildShortcutGroups(t);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (!isTyping && e.key === '?') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => setOpen(false)}
            aria-label={t('closeAria')}
          >
            &times;
          </button>
        </div>
        <div className="p-6 space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.heading}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.items.map((shortcut) => (
                  <li
                    key={shortcut.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-700">{shortcut.description}</span>
                    <span className="flex gap-1">
                      {shortcut.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-700"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
