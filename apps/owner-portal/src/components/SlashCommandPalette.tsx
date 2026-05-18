import React, { useEffect, useMemo, useState } from 'react';

/**
 * SlashCommandPalette — Cmd-K-style overlay surfaced when the owner
 * types `/` in the Jarvis chat. Built-in commands cover the most common
 * owner intents (arrears, payroll, KRA, inspections, notices) plus the
 * two new owner surfaces /plan and /skills.
 *
 * Owners can extend the built-in list with their own commands — these
 * persist in localStorage (key: `bn.slash-commands.user`). A future
 * iteration will sync them server-side via the brain's preferences API.
 */

const STORAGE_KEY = 'bn.slash-commands.user';

export interface SlashCommand {
  readonly id: string;
  readonly label: string;
  /** The slash trigger including leading `/` (e.g. `/arrears`). */
  readonly trigger: string;
  readonly description?: string;
  /**
   * Resolver. For static commands a string. For commands needing args
   * (e.g. `/inspect <unit>`), a function that receives the remainder
   * after the trigger and returns the resolved prompt.
   */
  readonly resolve: string | ((rest: string) => string);
  /** Optional client-side route (used by /plan and /skills). */
  readonly route?: string;
  readonly category: 'arrears' | 'payroll' | 'compliance' | 'inspect' | 'comms' | 'nav' | 'custom';
}

const BUILT_IN_COMMANDS: ReadonlyArray<SlashCommand> = [
  {
    id: 'arrears',
    label: 'Arrears',
    trigger: '/arrears',
    description: 'Show current arrears',
    resolve: 'show me current arrears',
    category: 'arrears',
  },
  {
    id: 'payroll',
    label: 'Payroll review',
    trigger: '/payroll',
    description: "Kick off this month's payroll review",
    resolve: "kick off this month's payroll review",
    category: 'payroll',
  },
  {
    id: 'kra',
    label: 'KRA status',
    trigger: '/kra',
    description: 'Show KRA filing status',
    resolve: 'show KRA filing status',
    category: 'compliance',
  },
  {
    id: 'file-tax',
    label: 'File tax',
    trigger: '/file-tax',
    description: "Compile this month's KRA filing",
    resolve: "compile this month's KRA filing",
    category: 'compliance',
  },
  {
    id: 'inspect',
    label: 'Schedule inspection',
    trigger: '/inspect',
    description: 'Schedule inspection of <unit>',
    resolve: (rest) => `schedule inspection of ${rest || '<unit>'}`.trim(),
    category: 'inspect',
  },
  {
    id: 'notice',
    label: 'Draft notice',
    trigger: '/notice',
    description: 'Draft notice for <unit>',
    resolve: (rest) => `draft notice for ${rest || '<unit>'}`.trim(),
    category: 'comms',
  },
  {
    id: 'plan',
    label: 'Open plan',
    trigger: '/plan',
    description: 'Open the /plan page',
    resolve: 'navigate to the plan page',
    route: '/plan',
    category: 'nav',
  },
  {
    id: 'skills',
    label: 'Open skills',
    trigger: '/skills',
    description: 'Open the /skills marketplace',
    resolve: 'navigate to the skills page',
    route: '/skills',
    category: 'nav',
  },
];

function loadUserCommands(): ReadonlyArray<SlashCommand> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReadonlyArray<SlashCommand>;
    if (!Array.isArray(parsed)) return [];
    // Best-effort shape check; user commands resolve is always a string.
    return parsed.filter(
      (c) =>
        c && typeof c.trigger === 'string' && typeof c.label === 'string' && typeof c.resolve === 'string',
    );
  } catch {
    return [];
  }
}

function saveUserCommands(cmds: ReadonlyArray<SlashCommand>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cmds));
  } catch {
    /* ignore quota / disabled */
  }
}

export interface SlashCommandPaletteProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The text the owner has typed AFTER the leading `/`. */
  readonly query: string;
  /** Called with the resolved prompt (and optional route). */
  readonly onPick: (resolved: string, command: SlashCommand) => void;
  /** Whether picking should auto-submit. Defaults to true. */
  readonly autoSubmit?: boolean;
}

export function SlashCommandPalette({
  open,
  onClose,
  query,
  onPick,
  autoSubmit = true,
}: SlashCommandPaletteProps): JSX.Element | null {
  const [userCommands, setUserCommands] = useState<ReadonlyArray<SlashCommand>>(() =>
    loadUserCommands(),
  );
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftTrigger, setDraftTrigger] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');

  const allCommands = useMemo(
    () => [...BUILT_IN_COMMANDS, ...userCommands],
    [userCommands],
  );

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return allCommands;
    // Split by first space: tokens[0] is the trigger; rest is the arg.
    const [head] = trimmed.split(/\s+/);
    return allCommands.filter((c) => {
      const t = c.trigger.toLowerCase();
      return t.startsWith(`/${head}`) || t.startsWith(head);
    });
  }, [allCommands, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        const cmd = filtered[selectedIdx];
        if (cmd) {
          e.preventDefault();
          pick(cmd);
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selectedIdx]);

  function pick(cmd: SlashCommand): void {
    const trimmed = query.trim();
    const rest = trimmed.startsWith(cmd.trigger.slice(1))
      ? trimmed.slice(cmd.trigger.length - 1).trim()
      : trimmed;
    const resolved =
      typeof cmd.resolve === 'string' ? cmd.resolve : cmd.resolve(rest);
    onPick(resolved, cmd);
    onClose();
  }

  function addUserCommand(): void {
    if (!draftLabel || !draftTrigger || !draftPrompt) return;
    const cleanTrigger = draftTrigger.startsWith('/') ? draftTrigger : `/${draftTrigger}`;
    const next: SlashCommand = {
      id: `user-${cleanTrigger.slice(1)}`,
      label: draftLabel,
      trigger: cleanTrigger,
      resolve: draftPrompt,
      category: 'custom',
    };
    const updated = [...userCommands.filter((c) => c.trigger !== cleanTrigger), next];
    setUserCommands(updated);
    saveUserCommands(updated);
    setDraftLabel('');
    setDraftTrigger('');
    setDraftPrompt('');
  }

  function removeUserCommand(id: string): void {
    const updated = userCommands.filter((c) => c.id !== id);
    setUserCommands(updated);
    saveUserCommands(updated);
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Slash command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 px-4 py-2 text-xs uppercase tracking-wide text-gray-500">
          Slash commands — {filtered.length} match{filtered.length === 1 ? '' : 'es'}
          {autoSubmit ? ' · Enter auto-submits' : ' · Enter inserts'}
        </div>
        <ul className="max-h-72 list-none overflow-y-auto p-0">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">No commands match.</li>
          ) : (
            filtered.map((cmd, i) => (
              <li
                key={cmd.id}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${
                  i === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => pick(cmd)}
              >
                <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">
                  {cmd.trigger}
                </code>
                <span className="flex-1">
                  <span className="font-medium text-gray-900">{cmd.label}</span>
                  {cmd.description ? (
                    <span className="ml-2 text-gray-500">{cmd.description}</span>
                  ) : null}
                </span>
                {cmd.category === 'custom' ? (
                  <button
                    type="button"
                    aria-label={`Remove ${cmd.label}`}
                    className="text-xs text-gray-400 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUserCommand(cmd.id);
                    }}
                  >
                    remove
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-gray-100 px-4 py-3">
          <details>
            <summary className="cursor-pointer text-xs font-medium text-gray-700">
              Add your own slash command
            </summary>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <input
                type="text"
                placeholder="Label"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1"
              />
              <input
                type="text"
                placeholder="/trigger"
                value={draftTrigger}
                onChange={(e) => setDraftTrigger(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1"
              />
              <input
                type="text"
                placeholder="resolved prompt"
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1"
              />
              <button
                type="button"
                onClick={addUserCommand}
                className="col-span-3 rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
              >
                Save command
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
