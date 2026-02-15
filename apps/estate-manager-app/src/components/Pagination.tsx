'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@bossnyumba/design-system';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showFirstLast?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  showFirstLast = false,
}: PaginationProps) {
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const getPageNumbers = () => {
    const delta = 1;
    const range: number[] = [];
    const rangeWithDots: (number | 'ellipsis')[] = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, 'ellipsis');
    } else if (currentPage <= 2 && totalPages > 1) {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('ellipsis', totalPages);
    } else if (currentPage >= totalPages - 1 && totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    if (totalPages === 1) return [1];
    return rangeWithDots;
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-2', className)}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canGoPrev}
        className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {showFirstLast && currentPage > 2 && (
        <button
          type="button"
          onClick={() => onPageChange(1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
        >
          1
        </button>
      )}

      <div className="flex items-center gap-1">
        {getPageNumbers().map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={cn(
                'min-w-[2.25rem] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                currentPage === page
                  ? 'bg-primary-600 text-white border border-primary-600'
                  : 'border border-gray-200 hover:bg-gray-50'
              )}
            >
              {page}
            </button>
          )
        )}
      </div>

      {showFirstLast && currentPage < totalPages - 1 && totalPages > 3 && (
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
        >
          {totalPages}
        </button>
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canGoNext}
        className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
