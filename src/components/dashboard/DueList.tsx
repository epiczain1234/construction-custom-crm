"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ContactStatus, ContactType } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { formatDue } from "@/lib/format";
import { dismissFollowUp, snoozeFollowUp } from "@/app/actions/reminders";

export interface DueContact {
  id: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  type: ContactType;
  status: ContactStatus;
  nextFollowUpAt: string | null;
  overdue: boolean;
}

export function DueList({ contacts }: { contacts: DueContact[] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        🎉 Nothing due. You&apos;re all caught up.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {contacts.map((c) => (
        <DueRow key={c.id} contact={c} />
      ))}
    </ul>
  );
}

function DueRow({ contact: c }: { contact: DueContact }) {
  const [pending, startTransition] = useTransition();
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");

  return (
    <li className={`flex items-center gap-4 px-4 py-3 ${pending ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:underline">
            {name}
          </Link>
          <StatusBadge status={c.status} />
        </div>
        <div className="truncate text-sm text-slate-500">
          {[c.company, CONTACT_TYPE_LABELS[c.type], c.phone].filter(Boolean).join(" · ")}
        </div>
      </div>

      <span
        className={`shrink-0 text-sm font-medium ${c.overdue ? "text-rose-600" : "text-slate-500"}`}
      >
        {formatDue(c.nextFollowUpAt)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {c.phone && (
          <a
            href={`tel:${c.phone}`}
            className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
          >
            Call
          </a>
        )}
        <button
          onClick={() => startTransition(() => snoozeFollowUp(c.id, 1))}
          disabled={pending}
          className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          +1d
        </button>
        <button
          onClick={() => startTransition(() => snoozeFollowUp(c.id, 7))}
          disabled={pending}
          className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          +7d
        </button>
        <button
          onClick={() => startTransition(() => dismissFollowUp(c.id))}
          disabled={pending}
          className="rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}
