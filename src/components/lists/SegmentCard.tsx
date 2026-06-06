import Link from "next/link";

export function SegmentCard({
  id,
  name,
  description,
  assigneeName,
  count,
}: {
  id: string;
  name: string;
  description: string | null;
  assigneeName: string | null;
  count: number;
}) {
  return (
    <Link
      href={`/lists/${id}`}
      className="block rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-slate-900">{name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            assigneeName ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {assigneeName ? assigneeName : "Unassigned"}
        </span>
      </div>
      {description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{description}</p>}
      <p className="mt-2 text-xs text-slate-400">
        {count} contact{count === 1 ? "" : "s"}
      </p>
    </Link>
  );
}
