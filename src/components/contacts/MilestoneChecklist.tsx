"use client";

import { useTransition } from "react";
import { MILESTONE_LABELS, type MilestoneKey } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { setMilestone } from "@/app/actions/lifecycle";

export type MilestoneState = Record<MilestoneKey, string | null>;

/**
 * Active-client milestone checklist. Each box is a yes/no with a completion date.
 * Checking "Finished serving" promotes the contact to a Warm Lead (handled server-side).
 */
export function MilestoneChecklist({
  contactId,
  milestones,
}: {
  contactId: string;
  milestones: MilestoneState;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={pending ? "opacity-50" : ""}>
      <ul className="space-y-1.5">
        {(Object.keys(MILESTONE_LABELS) as MilestoneKey[]).map((key) => {
          const at = milestones[key];
          const done = !!at;
          return (
            <li key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={done}
                disabled={pending}
                onChange={(e) =>
                  startTransition(() => setMilestone(contactId, key, e.target.checked))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className={done ? "text-slate-900" : "text-slate-600"}>
                {MILESTONE_LABELS[key]}
              </span>
              {done && <span className="text-xs text-slate-400">· {formatDate(at)}</span>}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-400">
        Checking “{MILESTONE_LABELS.FINISHED_SERVING}” moves this contact to Warm Leads.
      </p>
    </div>
  );
}
