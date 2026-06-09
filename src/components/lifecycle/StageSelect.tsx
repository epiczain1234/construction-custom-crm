"use client";

import { useTransition } from "react";
import { ContactStage } from "@/generated/prisma/enums";
import { CONTACT_STAGE_LABELS } from "@/lib/labels";
import { setContactStage } from "@/app/actions/lifecycle";

/** Inline stage mover — used on the contact detail page and the lifecycle lists. */
export function StageSelect({ contactId, stage }: { contactId: string; stage: ContactStage }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={stage}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => setContactStage(contactId, e.target.value as ContactStage))
      }
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
    >
      {Object.entries(CONTACT_STAGE_LABELS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}
