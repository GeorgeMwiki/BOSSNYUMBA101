import React from 'react';
import { SkillCard, type SkillSummary } from './SkillCard';

/**
 * SkillLibraryGrid — responsive grid of SkillCards.
 */

export interface SkillLibraryGridProps {
  readonly skills: ReadonlyArray<SkillSummary>;
  readonly onToggle: (skillId: string, nextEnabled: boolean) => void;
  readonly onInstall: (skillId: string) => void;
  readonly onRun: (skillId: string) => void;
}

export function SkillLibraryGrid({
  skills,
  onToggle,
  onInstall,
  onRun,
}: SkillLibraryGridProps): JSX.Element {
  if (skills.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        No skills match your filters.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((s) => (
        <SkillCard
          key={s.id}
          skill={s}
          onToggle={onToggle}
          onInstall={onInstall}
          onRun={onRun}
        />
      ))}
    </div>
  );
}
