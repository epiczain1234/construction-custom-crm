import { SkeletonBar, SkeletonCard } from "@/components/Skeleton";

export default function CallLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <SkeletonBar className="h-7 w-36" />
          <SkeletonBar className="mt-2 h-4 w-64" />
        </div>
        <SkeletonBar className="h-9 w-28" />
      </div>
      <div className="space-y-3">
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-16" />
        <SkeletonCard className="h-16" />
      </div>
    </div>
  );
}
