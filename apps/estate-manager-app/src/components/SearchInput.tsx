'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@bossnyumba/design-system';

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
  inputClassName,
  disabled = false,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(controlledValue ?? '');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (controlledValue !== undefined && controlledValue !== localValue) {
      setLocalValue(controlledValue);
    }
  }, [controlledValue]);

  useEffect(() => {
    if (debounceMs > 0) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChange(localValue);
        timeoutRef.current = null;
      }, debounceMs);
      return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
    onChange(localValue);
  }, [localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div
      className={cn(
        'relative flex items-center',
        className
      )}
    >
      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="search"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Search"
        className={cn(
          'w-full pl-9 pr-9 py-2.5 rounded-lg border border-gray-200 bg-white text-sm',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          inputClassName
        )}
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
