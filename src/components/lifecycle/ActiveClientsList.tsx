"use client";

import Link from "next/link";
import { ContactStage, ContactStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { MilestoneChecklist, type MilestoneState } from "@/components/contacts/MilestoneChecklist";
import { StageSelect } from "@/components/lifecycle/StageSelect";
import { ScheduleControl } from "@/components/lifecycle/ScheduleControl";
import { formatDue, formatDate } from "@/lib/format";

export interface ActiveClient {
  id: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  status: ContactStatus;
  stage: ContactStage;
  nextFollowUpAt: string | null;
  lastNote: string | null;
  lastNoteAt: string | null;
  milestones: MilestoneState;
}

export function ActiveClientsList({ clients }: { clients: ActiveClient[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No active clients yet. Win a cold lead or add one directly.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {clients.map((c) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
        return (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/contacts/${c.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {name}
                </Link>
                <div className="truncate text-sm text-slate-500">
                  {[c.company, c.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              {c.lastNote ? (
                <>
                  <p className="line-clamp-2 text-sm text-slate-700">{c.lastNote}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Last note · {formatDate(c.lastNoteAt)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">No notes yet</p>
              )}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <MilestoneChecklist contactId={c.id} milestones={c.milestones} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                Follow-up: <span className="font-medium text-slate-700">{formatDue(c.nextFollowUpAt)}</span>
              </span>
              <div className="flex items-center gap-2">
                <ScheduleControl contactId={c.id} />
                <StageSelect contactId={c.id} stage={c.stage} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
