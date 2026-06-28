import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactStage } from "@/generated/prisma/enums";
import { ActiveClientsList, type ActiveClient } from "@/components/lifecycle/ActiveClientsList";

export const dynamic = "force-dynamic";

export default async function ActiveClientsPage() {
  const user = await requireUser();

  const clients = await prisma.contact.findMany({
    where: { stage: ContactStage.ACTIVE_CLIENT, ownerId: user.id },
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true, firstName: true, lastName: true, company: true, phone: true,
      status: true, stage: true, nextFollowUpAt: true,
      milestoneDocsFilledAt: true, milestonePaymentCollectedAt: true,
      milestoneKickoffScheduledAt: true, milestoneFinishedServingAt: true,
      activities: {
        where: { note: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { note: true, createdAt: true },
      },
    },
  });

  const data: ActiveClient[] = clients.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    phone: c.phone,
    status: c.status,
    stage: c.stage,
    nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
    lastNote: c.activities[0]?.note ?? null,
    lastNoteAt: c.activities[0]?.createdAt.toISOString() ?? null,
    milestones: {
      DOCS: c.milestoneDocsFilledAt?.toISOString() ?? null,
      PAYMENT: c.milestonePaymentCollectedAt?.toISOString() ?? null,
      KICKOFF: c.milestoneKickoffScheduledAt?.toISOString() ?? null,
      FINISHED_SERVING: c.milestoneFinishedServingAt?.toISOString() ?? null,
    },
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Active clients</h1>
          <p className="text-sm text-slate-500">
            Clients you&apos;re serving — track milestones and schedule follow-ups.
          </p>
        </div>
        <Link
          href="/contacts/new?stage=ACTIVE_CLIENT"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Add client
        </Link>
      </div>

      <ActiveClientsList clients={data} />
      <p className="mt-2 text-xs text-slate-400">{data.length} active client(s)</p>
    </div>
  );
}
