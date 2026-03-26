export function PageSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="h-8 bg-surface-card rounded w-48" />
      <div className="h-4 bg-surface-card rounded w-32" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-spotify p-4 space-y-3">
            <div className="h-4 bg-surface-card rounded w-3/4" />
            <div className="h-3 bg-surface-card rounded w-1/2" />
            <div className="h-3 bg-surface-card rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-spotify p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-card rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-card rounded w-3/4" />
              <div className="h-3 bg-surface-card rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-spotify p-4 space-y-2">
          <div className="h-8 bg-surface-card rounded w-16" />
          <div className="h-3 bg-surface-card rounded w-24" />
        </div>
      ))}
    </div>
  );
}
