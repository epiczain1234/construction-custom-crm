import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { endOfDay, startOfDay } from "@/lib/scheduling";
import { ContactStage, ContactStatus } from "@/generated/prisma/enums";
import { DueList, type DueContact } from "@/components/dashboard/DueList";
import { WeeklyMetrics } from "@/components/dashboard/WeeklyMetrics";
import { PersonComparison } from "@/components/dashboard/PersonComparison";
import { getWeeklyAnalytics, getPerPersonWeekly, getWeeklyFunnelContacts, getWeeklyFollowContacts } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const dueBefore = endOfDay(now);

  // Cold-pipeline contacts that are "mine" = those on a list assigned to me.
  const mineFilter = { segments: { some: { segment: { assigneeId: user.id } } } };
  // Lifecycle (active/warm) contacts are grouped by ownership, not by calling list.
  const ownerFilter = { ownerId: user.id };
  // Shared select shape for the due lists.
  const dueSelect = {
    id: true, firstName: true, lastName: true, company: true,
    phone: true, type: true, status: true, stage: true, nextFollowUpAt: true,
  } as const;

  const [myLists, due, activeDue, warmDue, dueGroups, analytics, funnelContacts, followContacts, perPerson, callableCount] =
    await Promise.all([
      // Lists assigned to me, with total contact counts.
      prisma.segment.findMany({
        where: { assigneeId: user.id },
        orderBy: { name: "asc" },
        include: { _count: { select: { contacts: true } } },
      }),
      // My COLD follow-ups due today / overdue.
      prisma.contact.findMany({
        where: { AND: [mineFilter, { stage: ContactStage.COLD_LEAD }, { nextFollowUpAt: { lte: dueBefore } }] },
        orderBy: { nextFollowUpAt: "asc" },
        select: dueSelect,
      }),
      // My active-client follow-ups due (milestones / check-ins).
      prisma.contact.findMany({
        where: { AND: [ownerFilter, { stage: ContactStage.ACTIVE_CLIENT }, { nextFollowUpAt: { lte: dueBefore } }] },
        orderBy: { nextFollowUpAt: "asc" },
        select: dueSelect,
      }),
      // My warm-lead touchpoints due.
      prisma.contact.findMany({
        where: { AND: [ownerFilter, { stage: ContactStage.WARM_LEAD }, { nextFollowUpAt: { lte: dueBefore } }] },
        orderBy: { nextFollowUpAt: "asc" },
        select: dueSelect,
      }),
      // Due-now COLD counts per list (one grouped query) for the list cards.
      prisma.contactSegment.groupBy({
        by: ["segmentId"],
        where: { contact: { stage: ContactStage.COLD_LEAD, nextFollowUpAt: { lte: dueBefore } } },
        _count: { contactId: true },
      }),
      // Company-wide weekly call/appointment analytics + funnel.
      getWeeklyAnalytics(now),
      // The contacts behind this week's funnel (for the drill-down).
      getWeeklyFunnelContacts(now),
      // The accounts behind this week's follows (for the Follows drill-down).
      getWeeklyFollowContacts(now),
      // Per-person head-to-head (calls + appointments this week).
      getPerPersonWeekly(now),
      // Everything cold-callable right now on my lists (never-called + due), for the CTA.
      prisma.contact.count({
        where: {
          AND: [
            mineFilter,
            { stage: ContactStage.COLD_LEAD },
            { doNotCall: false },
            { status: { notIn: [ContactStatus.WON, ContactStatus.DEAD] } },
            { OR: [{ nextFollowUpAt: null }, { nextFollowUpAt: { lte: dueBefore } }] },
          ],
        },
      }),
    ]);

  const dueBySegment = new Map(dueGroups.map((g) => [g.segmentId, g._count.contactId]));

  const startToday = startOfDay(now).getTime();
  // Cold rows keep their status badge; active/warm rows show a stage badge.
  const toDue = (c: (typeof due)[number], withStage: boolean): DueContact => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    phone: c.phone,
    type: c.type,
    status: c.status,
    stage: withStage ? c.stage : undefined,
    nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
    overdue: !!c.nextFollowUpAt && c.nextFollowUpAt.getTime() < startToday,
  });
  const contacts = due.map((c) => toDue(c, false));
  const activeContacts = activeDue.map((c) => toDue(c, true));
  const warmContacts = warmDue.map((c) => toDue(c, true));

  const overdueCount = contacts.filter((c) => c.overdue).length;
  const todayCount = contacts.length - overdueCount;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Hi {user.name} 👋</h1>
        <p className="text-sm text-slate-500">Here&apos;s your work for today.</p>
      </div>

      {/* Primary call-to-action — the main thing to do from here. */}
      <Link
        href="/call"
        className="group mb-6 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white shadow-sm transition-all hover:shadow-md hover:brightness-105"
      >
        <div>
          <div className="text-xl font-bold">
            {callableCount > 0
              ? `${callableCount} call${callableCount === 1 ? "" : "s"} ready to go`
              : "Ready to call"}
          </div>
          <div className="text-sm text-emerald-50">
            {callableCount > 0
              ? overdueCount > 0
                ? `${overdueCount} overdue · work your lists one at a time.`
                : "Work through your list one at a time."
              : "Pick a list and start dialing."}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-emerald-700 shadow-sm transition-transform group-hover:translate-x-0.5">
          📞 Start calling →
        </span>
      </Link>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Overdue" value={overdueCount} accent="text-rose-600" />
        <Stat label="Due today" value={todayCount} accent="text-slate-900" />
        <Stat label="My lists" value={myLists.length} accent="text-indigo-600" />
      </div>

      {/* Company-wide weekly performance + funnel vs benchmark */}
      <WeeklyMetrics data={analytics} funnelContacts={funnelContacts} followContacts={followContacts} />

      {/* Per-person head-to-head: calls + appointments this week */}
      <PersonComparison people={perPerson} />

      {/* My assigned lists */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          My lists
        </h2>
        {myLists.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
            No lists assigned to you. <Link href="/lists" className="underline">Browse lists</Link> or
            ask to be assigned one.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myLists.map((s) => {
              const dueCount = dueBySegment.get(s.id) ?? 0;
              return (
                <Link
                  key={s.id}
                  href={`/call/${s.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-600"
                >
                  <div>
                    <h3 className="font-medium text-slate-900">{s.name}</h3>
                    <p className="text-xs text-slate-400">{s._count.contacts} contacts</p>
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
      </section>

      {/* Lifecycle work comes first — clients we're serving / nurturing take priority. */}
      {activeContacts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-500">
            Active clients due
          </h2>
          <DueList contacts={activeContacts} />
        </section>
      )}

      {warmContacts.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Warm leads due
          </h2>
          <DueList contacts={warmContacts} />
        </section>
      )}

      {/* My due cold follow-ups */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Follow-ups due
        </h2>
        <DueList contacts={contacts} />
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`text-3xl font-semibold ${accent}`}>{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
