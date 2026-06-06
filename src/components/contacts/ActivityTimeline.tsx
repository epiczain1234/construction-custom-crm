import { ActivityType, CallOutcome } from "@/generated/prisma/enums";
import { CALL_OUTCOME_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

interface TimelineActivity {
  id: string;
  type: ActivityType;
  outcome: CallOutcome | null;
  note: string | null;
  createdAt: Date;
  user: { name: string };
  transcript: { text: string } | null;
}

export function ActivityTimeline({ activities }: { activities: TimelineActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-slate-400">No activity yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-slate-900">
              {a.type === ActivityType.CALL
                ? `📞 ${a.outcome ? CALL_OUTCOME_LABELS[a.outcome] : "Call"}`
                : a.type === ActivityType.NOTE
                  ? "📝 Note"
                  : "Status change"}
            </span>
            <span className="text-xs text-slate-400">
              {a.user.name} · {formatDateTime(a.createdAt)}
            </span>
          </div>
          {a.note && <p className="mt-1 text-sm text-slate-600">{a.note}</p>}
          {a.transcript && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                View transcript
              </summary>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                {a.transcript.text}
              </p>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
