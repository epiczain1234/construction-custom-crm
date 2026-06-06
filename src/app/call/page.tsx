import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SegmentVisibility } from "@/generated/prisma/enums";
import { endOfDay } from "@/lib/scheduling";

export const dynamic = "force-dynamic";

export default async function CallPickerPage() {
  const user = await requireUser();

  // Fetch lists and the "due now" counts in parallel. The due counts are a single
  // grouped query (one round-trip) instead of one count per list (N+1).
  const [segments, dueGroups] = await Promise.all([
    prisma.segment.findMany({
      where: { OR: [{ ownerId: user.id }, { visibility: SegmentVisibility.SHARED }] },
      orderBy: { name: "asc" },
      include: {
        owner: { select: { name: true } },
        _count: { select: { contacts: true } },
      },
    }),
    prisma.contactSegment.groupBy({
      by: ["segmentId"],
      where: { contact: { nextFollowUpAt: { lte: endOfDay(new Date()) } } },
      _count: { contactId: true },
    }),
  ]);

  const dueBySegment = new Map(dueGroups.map((g) => [g.segmentId, g._count.contactId]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Call mode</h1>
      <p className="mb-6 text-sm text-slate-500">Pick a list to work through, one contact at a time.</p>

      {segments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No lists yet. <Link href="/lists/new" className="underline">Create one</Link> and add contacts.
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((s) => {
            const dueCount = dueBySegment.get(s.id) ?? 0;
            return (
              <Link
                key={s.id}
                href={`/call/${s.id}`}
                className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-600 ${
                  s._count.contacts === 0 ? "pointer-events-none opacity-50" : ""
                }`}
              >
                <div>
                  <h2 className="font-medium text-slate-900">{s.name}</h2>
                  <p className="text-xs text-slate-400">
                    {s._count.contacts} contacts · {s.owner.name}
                  </p>
                </div>
                <div className="text-right">
                  {dueCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                      {dueCount} due
                    </span>
                  )}
                  <span className="ml-2 text-emerald-600">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
