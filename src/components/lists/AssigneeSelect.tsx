"use client";

import { useTransition } from "react";
import { setSegmentAssignee } from "@/app/actions/segments";

export function AssigneeSelect({
  segmentId,
  assigneeId,
  users,
}: {
  segmentId: string;
  assigneeId: string | null;
  users: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value || null;
        startTransition(() => setSegmentAssignee(segmentId, value));
      }}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-900 focus:outline-none disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
