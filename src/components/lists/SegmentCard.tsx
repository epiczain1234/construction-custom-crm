import Link from "next/link";
import { SegmentVisibility } from "@/generated/prisma/enums";
import { SEGMENT_VISIBILITY_LABELS } from "@/lib/labels";

export function SegmentCard({
  id,
  name,
  description,
  visibility,
  ownerName,
  count,
}: {
  id: string;
  name: string;
  description: string | null;
  visibility: SegmentVisibility;
  ownerName: string;
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
            visibility === SegmentVisibility.SHARED
              ? "bg-sky-100 text-sky-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {SEGMENT_VISIBILITY_LABELS[visibility]}
        </span>
      </div>
      {description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{description}</p>}
      <p className="mt-2 text-xs text-slate-400">
        {count} contact{count === 1 ? "" : "s"} · {ownerName}
      </p>
    </Link>
  );
}
