"use client";

import { useState, useTransition } from "react";
import { setSegmentMembership } from "@/app/actions/contacts";

export function AddToListForm({
  segmentId,
  candidates,
}: {
  segmentId: string;
  candidates: { id: string; label: string }[];
}) {
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return <p className="text-sm text-slate-400">All contacts are already on this list.</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Add an existing contact…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>{c.label}</option>
        ))}
      </select>
      <button
        disabled={!selected || pending}
        onClick={() =>
          startTransition(async () => {
            await setSegmentMembership(selected, segmentId, true);
            setSelected("");
          })
        }
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
