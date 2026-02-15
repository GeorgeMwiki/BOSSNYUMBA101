'use client';

import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-10 w-10 text-xs',
  md: 'h-14 w-14 text-base',
  lg: 'h-20 w-20 text-lg',
  xl: 'h-24 w-24 text-xl',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ src, alt, name, size = 'md', className = '' }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const showFallback = !src || hasError;
  const initials = name ? getInitials(name) : '?';

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 ${sizeClasses[size]} ${className}`}
    >
      {showFallback ? (
        <span className="font-medium text-primary-600">{initials}</span>
      ) : (
        <img
          src={src}
          alt={alt || name || 'Profile'}
          className="aspect-square h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
