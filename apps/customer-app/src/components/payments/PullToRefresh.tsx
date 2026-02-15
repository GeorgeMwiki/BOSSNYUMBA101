'use client';

import { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);

  const PULL_THRESHOLD = 80;
  const maxPull = 120;

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      startY.current = e.touches[0].clientY;
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isRefreshing) return;
      const scrollTop = window.scrollY ?? document.documentElement.scrollTop;
      if (scrollTop > 0) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 0) {
        const distance = Math.min(diff * 0.5, maxPull);
        setPullDistance(distance);
      }
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (isRefreshing) return;

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      className="min-h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex justify-center items-center py-3 transition-opacity"
          style={{
            height: Math.max(pullDistance, isRefreshing ? 50 : 0),
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
          }}
        >
          {isRefreshing ? (
            <RefreshCw className="w-5 h-5 text-primary-600 animate-spin" />
          ) : (
            <RefreshCw
              className="w-5 h-5 text-gray-400"
              style={{ transform: `rotate(${Math.min(pullDistance * 2, 360)}deg)` }}
            />
          )}
        </div>
      )}
      {children}
    </div>
  );
}
