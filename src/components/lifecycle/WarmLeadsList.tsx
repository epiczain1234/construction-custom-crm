"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ContactStage, ContactStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { StageSelect } from "@/components/lifecycle/StageSelect";
import { ScheduleControl } from "@/components/lifecycle/ScheduleControl";
import { formatDue } from "@/lib/format";
import { logWarmTouch, scheduleNextTouchpoint, setWarmLeadDead } from "@/app/actions/lifecycle";

export interface WarmLead {
  id: string;
  firstName: string;
  lastName: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  status: ContactStatus;
  stage: ContactStage;
  nextFollowUpAt: string | null;
}

export function WarmLeadsList({ leads }: { leads: WarmLead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No warm leads yet. Finish serving an active client or add one directly.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {leads.map((c) => (
        <WarmRow key={c.id} lead={c} />
      ))}
    </ul>
  );
}

function WarmRow({ lead: c }: { lead: WarmLead }) {
  const [pending, startTransition] = useTransition();
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  const dead = c.status === "DEAD";

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${pending || dead ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:underline">
            {name}
          </Link>
          <StatusBadge status={c.status} />
        </div>
        <div className="truncate text-sm text-slate-500">
          {[c.title, c.company, c.phone].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>

      <span className="shrink-0 text-sm font-medium text-slate-500">
        {dead ? "—" : formatDue(c.nextFollowUpAt)}
      </span>

      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {dead ? (
          <button
            onClick={() => startTransition(() => setWarmLeadDead(c.id, false))}
            disabled={pending}
            title="Bring this warm lead back onto the touchpoint cadence"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            Revive
          </button>
        ) : (
          <>
            {c.phone && (
              <a
                href={`tel:${c.phone}`}
                className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              >
                Call
              </a>
            )}
            <button
              onClick={() => startTransition(() => logWarmTouch(c.id))}
              disabled={pending}
              title="Record an outreach and advance to the next touchpoint"
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              Log touch
            </button>
            <button
              onClick={() => startTransition(() => scheduleNextTouchpoint(c.id))}
              disabled={pending}
              title="Schedule the next holiday / tax-deadline touchpoint"
              className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            >
              Next touchpoint
            </button>
            <ScheduleControl contactId={c.id} />
            <button
              onClick={() => startTransition(() => setWarmLeadDead(c.id, true))}
              disabled={pending}
              title="Mark dead — keeps it here but stops follow-ups"
              className="rounded-md px-2 py-1.5 text-xs text-rose-500 hover:bg-rose-50 disabled:opacity-50"
            >
              Mark dead
            </button>
          </>
        )}
        <StageSelect contactId={c.id} stage={c.stage} />
      </div>
    </li>
  );
}
