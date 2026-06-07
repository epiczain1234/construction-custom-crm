import { SkeletonBar } from "@/components/Skeleton";

export default function ContactsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <SkeletonBar className="h-7 w-32" />
        <SkeletonBar className="h-9 w-28" />
      </div>
      <SkeletonBar className="mb-4 h-10 w-full" />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
