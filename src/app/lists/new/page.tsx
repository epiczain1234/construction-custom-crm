import Link from "next/link";
import { requireUser } from "@/lib/session";
import { createSegment } from "@/app/actions/segments";
import { SEGMENT_VISIBILITY_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function NewListPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <Link href="/lists" className="text-sm text-slate-500 hover:underline">
        ← Lists
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold text-slate-900">New list</h1>

      <form action={createSegment} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Name *</span>
          <input
            name="name"
            required
            placeholder="e.g. Downtown GCs"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Description</span>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-slate-700">Visibility</legend>
          <div className="flex gap-3">
            {Object.entries(SEGMENT_VISIBILITY_LABELS).map(([k, v], i) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="radio" name="visibility" value={k} defaultChecked={i === 0} />
                {v}
                <span className="text-xs text-slate-400">
                  {k === "SHARED" ? "(both of you)" : "(only you)"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Create list
          </button>
          <Link href="/lists" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
