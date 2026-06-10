import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactStage } from "@/generated/prisma/enums";
import { WarmLeadsList, type WarmLead } from "@/components/lifecycle/WarmLeadsList";
import { nextTouchpoint } from "@/lib/touchpoints";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WarmLeadsPage() {
  const user = await requireUser();

  const leads = await prisma.contact.findMany({
    where: { stage: ContactStage.WARM_LEAD, ownerId: user.id },
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true, firstName: true, lastName: true, title: true, company: true, phone: true,
      status: true, stage: true, nextFollowUpAt: true,
    },
  });

  const data: WarmLead[] = leads.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    company: c.company,
    phone: c.phone,
    status: c.status,
    stage: c.stage,
    nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
  }));

  const upcoming = nextTouchpoint(new Date());

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Warm leads</h1>
          <p className="text-sm text-slate-500">
            Past clients to nurture for referrals &amp; repeat business.
            {upcoming
              ? ` Next outreach ${formatDate(upcoming.date)} → ${upcoming.label} (${formatDate(upcoming.eventDate)}).`
              : " ⚠️ The touchpoint calendar needs extending past its last entry."}
          </p>
        </div>
        <Link
          href="/contacts/new?stage=WARM_LEAD"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + Add warm lead
        </Link>
      </div>

      <WarmLeadsList leads={data} />
      <p className="mt-2 text-xs text-slate-400">{data.length} warm lead(s)</p>
    </div>
  );
}
