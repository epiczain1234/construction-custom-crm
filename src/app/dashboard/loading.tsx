import { SkeletonBar, SkeletonCard } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SkeletonBar className="h-7 w-40" />
      <SkeletonBar className="mt-2 h-4 w-56" />
      <div className="mb-6 mt-6 grid grid-cols-3 gap-3">
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
        <SkeletonCard className="h-20" />
      </div>
      <SkeletonBar className="h-4 w-24" />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
