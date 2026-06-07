export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <SkeletonBar className="h-4 w-1/2" />
      <SkeletonBar className="mt-2 h-3 w-1/3" />
    </div>
  );
}
