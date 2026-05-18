import React from 'react';

/**
 * SkillInstallToggle — small switch used inside SkillCard. Pure
 * presentation; the parent owns the persisted state.
 */

export interface SkillInstallToggleProps {
  readonly enabled: boolean;
  readonly onChange: (next: boolean) => void;
}

export function SkillInstallToggle({
  enabled,
  onChange,
}: SkillInstallToggleProps): JSX.Element {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
      <span className={enabled ? 'text-emerald-700' : 'text-gray-500'}>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
      <span
        role="switch"
        aria-checked={enabled}
        tabIndex={0}
        onClick={() => onChange(!enabled)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!enabled);
          }
        }}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
          enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
            enabled ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </span>
    </label>
  );
}
