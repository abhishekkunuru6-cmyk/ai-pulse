export function ArticleCardSkeleton() {
  return (
    <div className="bg-surface-1 rounded-xl border border-zinc-800/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-16 h-4 bg-surface-2 rounded-full animate-pulse" />
        <div className="w-12 h-3 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-surface-2 rounded animate-pulse" />
        <div className="w-3/4 h-4 bg-surface-2 rounded animate-pulse" />
      </div>
      <div className="w-full h-3 bg-surface-2 rounded animate-pulse" />
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-surface-2 rounded-lg animate-pulse" />
        <div className="w-20 h-3 bg-surface-2 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatsBarSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="bg-surface-2 rounded-lg w-24 h-10 animate-pulse flex-shrink-0"
        />
      ))}
    </div>
  );
}
