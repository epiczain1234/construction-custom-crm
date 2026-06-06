import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { endOfDay, startOfDay } from "@/lib/scheduling";
import { DueList, type DueContact } from "@/components/dashboard/DueList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  // "My" follow-ups: contacts I own (or unassigned), due today or overdue.
  const ownerFilter = { OR: [{ ownerId: user.id }, { ownerId: null }] };

  const due = await prisma.contact.findMany({
    where: {
      AND: [ownerFilter, { nextFollowUpAt: { lte: endOfDay(now) } }],
    },
    orderBy: { nextFollowUpAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      phone: true,
      type: true,
      status: true,
      nextFollowUpAt: true,
    },
  });

  const startToday = startOfDay(now).getTime();
  const contacts: DueContact[] = due.map((c) => ({
    ...c,
    nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
    overdue: !!c.nextFollowUpAt && c.nextFollowUpAt.getTime() < startToday,
  }));

  const overdueCount = contacts.filter((c) => c.overdue).length;
  const todayCount = contacts.length - overdueCount;

  const upcomingCount = await prisma.contact.count({
    where: { AND: [ownerFilter, { nextFollowUpAt: { gt: endOfDay(now) } }] },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Hi {user.name} 👋
          </h1>
          <p className="text-sm text-slate-500">Here&apos;s who needs a follow-up.</p>
        </div>
        <Link
          href="/call"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Start calling →
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Overdue" value={overdueCount} accent="text-rose-600" />
        <Stat label="Due today" value={todayCount} accent="text-slate-900" />
        <Stat label="Upcoming" value={upcomingCount} accent="text-slate-400" />
      </div>

      <DueList contacts={contacts} />
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
