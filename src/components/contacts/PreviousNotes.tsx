import { ActivityType, CallOutcome } from "@/generated/prisma/enums";
import { CALL_OUTCOME_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export interface PreviousNote {
  id: string;
  note: string;
  outcome: CallOutcome | null;
  type: ActivityType;
  at: string | Date;
  by: string;
}

/** Notes the user logged on earlier calls/notes for this contact. Hidden when empty. */
export function PreviousNotes({ notes }: { notes: PreviousNote[] }) {
  if (notes.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="mb-2 text-sm font-semibold text-amber-900">📝 Previous notes</h2>
      <ol className="space-y-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-amber-100 bg-white p-2.5">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{n.note}</p>
            <p className="mt-1 text-xs text-slate-400">
              {n.type === ActivityType.CALL && n.outcome
                ? `${CALL_OUTCOME_LABELS[n.outcome]} · `
                : ""}
              {n.by} · {formatDateTime(n.at)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
