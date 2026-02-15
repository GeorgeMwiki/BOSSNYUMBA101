'use client';

import {
  Droplets,
  Zap,
  Thermometer,
  Refrigerator,
  Home,
  Bug,
  Shield,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryOption {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const CATEGORIES: CategoryOption[] = [
  { value: 'plumbing', label: 'Plumbing', description: 'Leaks, clogs, water', icon: Droplets },
  { value: 'electrical', label: 'Electrical', description: 'Lights, outlets, wiring', icon: Zap },
  { value: 'hvac', label: 'HVAC', description: 'Heating, cooling, AC', icon: Thermometer },
  { value: 'appliances', label: 'Appliances', description: 'Fridge, stove, washer', icon: Refrigerator },
  { value: 'structural', label: 'Structural', description: 'Walls, floors, doors', icon: Home },
  { value: 'pest_control', label: 'Pest Control', description: 'Insects, rodents', icon: Bug },
  { value: 'security', label: 'Security', description: 'Locks, alarms, access', icon: Shield },
  { value: 'general', label: 'General', description: 'Other issues', icon: Wrench },
];

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isSelected = value === cat.value;

        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => onChange(cat.value)}
            className={`card p-3 text-left transition-all flex flex-col items-start gap-2 ${
              isSelected
                ? 'ring-2 ring-primary-500 bg-primary-50 border-primary-200'
                : 'hover:bg-gray-50'
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                isSelected ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-medium text-sm">{cat.label}</div>
              <div className="text-xs text-gray-500">{cat.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
