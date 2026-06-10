"use client";

import { useState } from "react";
import Link from "next/link";
import type { CallOutcome } from "@/generated/prisma/enums";
import type { FunnelContact, FollowContact } from "@/lib/analytics";
import { CALL_OUTCOME_LABELS } from "@/lib/labels";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export type Bucket = "calls" | "connected" | "interested" | "appointments" | "follows";

export interface FunnelStage {
  label: string;
  actual: number;
  rate: number;
  baseline: boolean;
  raw: boolean;
  /** which contact set this row drills into (null = not clickable) */
  bucket: Bucket | null;
}

/** A row in an expanded drill-down list (unified across call buckets + follows). */
interface ShownRow {
  contactId: string;
  name: string;
  company: string | null;
  badge: string;
  byName: string;
}

// Which latest-call outcomes belong to each call funnel bucket (mirrors analytics tally()).
const BUCKET_OUTCOMES: Record<"connected" | "interested" | "appointments", CallOutcome[]> = {
  connected: ["INTERESTED", "APPOINTMENT_SET", "CLOSED_WON", "NOT_INTERESTED", "CALLBACK_REQUESTED"],
  interested: ["INTERESTED", "APPOINTMENT_SET", "CLOSED_WON"],
  appointments: ["APPOINTMENT_SET"],
};

function inCallBucket(c: FunnelContact, bucket: Bucket): boolean {
  if (bucket === "calls") return true;
  if (bucket === "follows") return false;
  return !!c.outcome && BUCKET_OUTCOMES[bucket].includes(c.outcome);
}

export function FunnelTable({
  calls,
  stages,
  contacts,
  follows,
}: {
  calls: number;
  stages: FunnelStage[];
  contacts: FunnelContact[];
  follows: FollowContact[];
}) {
  const [open, setOpen] = useState<Bucket | null>(null);

  if (calls === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No calls logged yet this week.</p>;
  }

  const shown: ShownRow[] = !open
    ? []
    : open === "follows"
      ? follows.map((f) => ({
          contactId: f.contactId,
          name: f.name,
          company: f.company,
          badge: f.kind === "dial" ? "Repeat dial" : "Touch",
          byName: f.byName,
        }))
      : contacts.filter((c) => inCallBucket(c, open)).map((c) => ({
          contactId: c.contactId,
          name: c.name,
          company: c.company,
          badge: c.outcome ? CALL_OUTCOME_LABELS[c.outcome] : "Call",
          byName: c.byName,
        }));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4 font-medium">Stage</th>
          <th className="px-2 py-2 text-right font-medium">Alexander &amp; Associates</th>
          <th className="px-2 py-2 text-right font-medium">Benchmark</th>
          <th className="py-2 pl-2 text-right font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((s) => {
          const benchCount = Math.round(calls * s.rate);
          const actualPct = s.actual / calls;
          const hit = s.baseline || s.actual >= benchCount;
          const isOpen = open === s.bucket;
          return (
            <FunnelRows
              key={s.label}
              stage={s}
              benchCount={benchCount}
              actualPct={actualPct}
              hit={hit}
              isOpen={isOpen}
              shown={isOpen ? shown : []}
              onToggle={() => s.bucket && setOpen(isOpen ? null : s.bucket)}
            />
          );
        })}
      </tbody>
    </table>
  );
}

function FunnelRows({
  stage: s,
  benchCount,
  actualPct,
  hit,
  isOpen,
  shown,
  onToggle,
}: {
  stage: FunnelStage;
  benchCount: number;
  actualPct: number;
  hit: boolean;
  isOpen: boolean;
  shown: ShownRow[];
  onToggle: () => void;
}) {
  const clickable = !!s.bucket;
  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="py-2 pr-4 font-medium text-slate-600">{s.label}</td>
        <td className="px-2 py-2 text-right tabular-nums text-slate-700">
          {clickable ? (
            <button
              onClick={onToggle}
              className="font-medium text-slate-900 underline decoration-dotted underline-offset-2 hover:text-emerald-700"
              title="Show who's in this number"
            >
              {s.actual}
            </button>
          ) : (
            s.actual
          )}
          {!s.raw && <span className="text-slate-400"> ({pct(actualPct)})</span>}
        </td>
        <td className="px-2 py-2 text-right tabular-nums text-slate-500">
          {s.baseline ? "—" : <>{benchCount} <span className="text-slate-400">({pct(s.rate)})</span></>}
        </td>
        <td className="py-2 pl-2 text-right">
          {s.baseline ? (
            <span className="text-slate-300">—</span>
          ) : (
            <span className={`font-medium ${hit ? "text-emerald-600" : "text-rose-600"}`}>
              {hit ? "▲ above" : "▼ below"}
            </span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50">
          <td colSpan={4} className="px-3 py-2">
            <div className="mb-1 text-xs text-slate-500">
              {shown.length} in “{s.label}” — click a name to open the contact and re-log if it&apos;s wrong.
            </div>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
              {shown.map((c, i) => (
                <li key={`${c.contactId}-${i}`} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <Link href={`/contacts/${c.contactId}`} className="font-medium text-slate-800 hover:underline">
                    {c.name}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {c.company && <span className="hidden sm:inline">{c.company}</span>}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                      {c.badge}
                    </span>
                    {c.byName && <span className="text-slate-400">by {c.byName}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
