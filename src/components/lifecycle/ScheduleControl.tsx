"use client";

import { useState, useTransition } from "react";
import { scheduleFollowUp } from "@/app/actions/lifecycle";

/** datetime-local picker that sets a contact's next follow-up to the chosen date. */
export function ScheduleControl({
  contactId,
  label = "Set date",
}: {
  contactId: string;
  label?: string;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
      />
      <button
        disabled={pending || !value}
        onClick={() =>
          startTransition(() => {
            scheduleFollowUp(contactId, new Date(value).toISOString());
            setValue("");
          })
        }
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
