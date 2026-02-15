'use client';

import { AlertTriangle, ArrowUp, Minus, ArrowDown } from 'lucide-react';

export interface PriorityOption {
  value: string;
  label: string;
  description: string;
  sla: string;
  icon: React.ElementType;
}

export const PRIORITIES: PriorityOption[] = [
  {
    value: 'emergency',
    label: 'Emergency',
    description: 'Safety hazard, no water/power, flooding',
    sla: '4 hour response',
    icon: AlertTriangle,
  },
  {
    value: 'high',
    label: 'High',
    description: 'Major inconvenience, limited functionality',
    sla: '24 hour response',
    icon: ArrowUp,
  },
  {
    value: 'normal',
    label: 'Normal',
    description: 'Needs attention but not urgent',
    sla: '72 hour response',
    icon: Minus,
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Minor issue, cosmetic',
    sla: '7 day response',
    icon: ArrowDown,
  },
];

interface PrioritySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PrioritySelector({ value, onChange }: PrioritySelectorProps) {
  return (
    <div className="space-y-2">
      {PRIORITIES.map((priority) => {
        const Icon = priority.icon;
        const isSelected = value === priority.value;

        return (
          <button
            key={priority.value}
            type="button"
            onClick={() => onChange(priority.value)}
            className={`card p-3 w-full text-left transition-all ${
              isSelected
                ? 'ring-2 ring-primary-500 bg-primary-50 border-primary-200'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    priority.value === 'emergency'
                      ? 'bg-danger-50 text-danger-600'
                      : isSelected
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {priority.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{priority.description}</div>
                </div>
              </div>
              <div className="text-xs text-primary-600 font-medium whitespace-nowrap">
                {priority.sla}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
