import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { endOfDay } from "@/lib/scheduling";
import { ActivityType } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

export default async function CallPickerPage() {
  const user = await requireUser();

  // Fetch lists and the "due now" counts in parallel. The due counts are a single
  // grouped query (one round-trip) instead of one count per list (N+1).
  const [allSegments, dueGroups] = await Promise.all([
    prisma.segment.findMany({
      // Managers see all lists; reps see only lists assigned to them.
      where: user.isAdmin ? undefined : { assigneeId: user.id },
      orderBy: { name: "asc" },
      include: {
        assignee: { select: { id: true, name: true } },
        _count: { select: { contacts: true } },
      },
    }),
    prisma.contactSegment.groupBy({
      by: ["segmentId"],
      where: { contact: { nextFollowUpAt: { lte: endOfDay(new Date()) } } },
      _count: { contactId: true },
    }),
  ]);

  // Show my lists first, then unassigned, then the rest.
  const rank = (assigneeId: string | null) =>
    assigneeId === user.id ? 0 : assigneeId == null ? 1 : 2;
  const segments = [...allSegments].sort((a, b) => rank(a.assigneeId) - rank(b.assigneeId));

  const dueBySegment = new Map(dueGroups.map((g) => [g.segmentId, g._count.contactId]));

  // "Already called" review: per visible person, how many leads they've logged a call on.
  // Admins see everyone; reps see only themselves.
  const visibleUsers = await prisma.user.findMany({
    where: user.isAdmin ? undefined : { id: user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const calledCounts = await Promise.all(
    visibleUsers.map((u) =>
      prisma.contact.count({
        where: { activities: { some: { type: ActivityType.CALL, userId: u.id } } },
      }),
    ),
  );
  const called = visibleUsers.map((u, i) => ({ ...u, count: calledCounts[i] }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Call mode</h1>
          <p className="text-sm text-slate-500">Pick a list to work through, one contact at a time.</p>
        </div>
        <Link
          href="/lists"
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Manage lists
        </Link>
      </div>

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
                    {s._count.contacts} contacts ·{" "}
                    {s.assignee ? (s.assignee.id === user.id ? "You" : s.assignee.name) : "Unassigned"}
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

      {/* Already-called review, per person */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Already called
        </h2>
        <div className="space-y-3">
          {called.map((p) => (
            <Link
              key={p.id}
              href={`/call/called/${p.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-600"
            >
              <div>
                <h3 className="font-medium text-slate-900">
                  {p.id === user.id ? "Your called leads" : `${p.name}'s called leads`}
                </h3>
                <p className="text-xs text-slate-400">{p.count} called</p>
              </div>
              <span className="text-slate-400">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
