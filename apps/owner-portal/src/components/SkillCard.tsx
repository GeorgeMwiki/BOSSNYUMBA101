import React from 'react';
import { Star, Clock, Zap, Hand, Calendar } from 'lucide-react';
import { SkillInstallToggle } from './SkillInstallToggle';

/**
 * SkillCard — one card per Skill in the marketplace grid. Renders name,
 * description, author, run count, and the install / enable toggle.
 *
 * Skills are owner-installable workflows the brain runs on cron / event /
 * manual triggers. Author can be MD (platform-shipped) or another tenant.
 */

export type SkillTrigger = 'cron' | 'event' | 'manual';
export type SkillCategory =
  | 'arrears'
  | 'lease'
  | 'maintenance'
  | 'comms'
  | 'compliance'
  | 'reporting';

export interface SkillSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly author: string;
  readonly authorIsMd: boolean;
  readonly category: SkillCategory;
  readonly triggerKind: SkillTrigger;
  readonly triggerLabel?: string;
  readonly installed: boolean;
  readonly enabled: boolean;
  readonly runCount: number;
  readonly lastRunAt?: string | null;
  readonly rating?: number | null;
}

const TRIGGER_ICON: Record<SkillTrigger, JSX.Element> = {
  cron: <Clock className="h-3.5 w-3.5" />,
  event: <Zap className="h-3.5 w-3.5" />,
  manual: <Hand className="h-3.5 w-3.5" />,
};

const TRIGGER_LABEL: Record<SkillTrigger, string> = {
  cron: 'Scheduled',
  event: 'Event-driven',
  manual: 'Manual',
};

export interface SkillCardProps {
  readonly skill: SkillSummary;
  readonly onToggle: (skillId: string, nextEnabled: boolean) => void;
  readonly onInstall: (skillId: string) => void;
  readonly onRun: (skillId: string) => void;
}

export function SkillCard({
  skill,
  onToggle,
  onInstall,
  onRun,
}: SkillCardProps): JSX.Element {
  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{skill.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
            <span>by {skill.author}</span>
            {skill.authorIsMd ? (
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-900">
                MD
              </span>
            ) : null}
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{skill.category}</span>
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5">
              {TRIGGER_ICON[skill.triggerKind]}
              {skill.triggerLabel ?? TRIGGER_LABEL[skill.triggerKind]}
            </span>
          </div>
        </div>
        {typeof skill.rating === 'number' ? (
          <div className="flex items-center gap-0.5 text-xs text-amber-600">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>{skill.rating.toFixed(1)}</span>
          </div>
        ) : null}
      </header>
      <p className="flex-1 text-sm text-gray-600">{skill.description}</p>
      <footer className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <div className="text-[10px] text-gray-500">
          {skill.runCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {skill.runCount} run{skill.runCount === 1 ? '' : 's'}
              {skill.lastRunAt ? ` · last ${skill.lastRunAt}` : ''}
            </span>
          ) : (
            <span>No runs yet</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {skill.triggerKind === 'manual' && skill.installed ? (
            <button
              type="button"
              onClick={() => onRun(skill.id)}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs"
            >
              Run now
            </button>
          ) : null}
          {skill.installed ? (
            <SkillInstallToggle
              enabled={skill.enabled}
              onChange={(next) => onToggle(skill.id, next)}
            />
          ) : (
            <button
              type="button"
              onClick={() => onInstall(skill.id)}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
            >
              Install
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}
