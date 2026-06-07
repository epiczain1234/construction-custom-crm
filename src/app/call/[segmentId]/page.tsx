import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CallModeClient, type CallContact } from "@/components/call/CallModeClient";

export const dynamic = "force-dynamic";

export default async function CallSegmentPage({
  params,
}: {
  params: Promise<{ segmentId: string }>;
}) {
  const user = await requireUser();
  const { segmentId } = await params;

  const segment = await prisma.segment.findUnique({
    where: { id: segmentId },
    include: {
      contacts: {
        // Due first (nulls last), so the call queue prioritizes follow-ups.
        orderBy: { contact: { nextFollowUpAt: { sort: "asc", nulls: "last" } } },
        include: {
          contact: {
            include: {
              // Prior notes (most recent first) to show above the log-outcome panel.
              activities: {
                where: { note: { not: null } },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                  id: true,
                  note: true,
                  outcome: true,
                  type: true,
                  createdAt: true,
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!segment) notFound();
  // Reps can only open lists assigned to them.
  if (!user.isAdmin && segment.assigneeId !== user.id) notFound();

  const contacts: CallContact[] = segment.contacts
    .map((cs) => cs.contact)
    .filter((c) => !c.doNotCall)
    .map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      title: c.title,
      phone: c.phone,
      notes: c.notes,
      type: c.type,
      status: c.status,
      nextFollowUpAt: c.nextFollowUpAt?.toISOString() ?? null,
      previousNotes: c.activities.map((a) => ({
        id: a.id,
        note: a.note as string,
        outcome: a.outcome,
        type: a.type,
        at: a.createdAt.toISOString(),
        by: a.user.name,
      })),
    }));

  if (contacts.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{segment.name}</h1>
        <p className="mt-2 text-sm text-slate-500">No callable contacts on this list.</p>
        <Link href={`/lists/${segment.id}`} className="mt-4 inline-block text-sm text-slate-700 underline">
          Add contacts →
        </Link>
      </div>
    );
  }

  return <CallModeClient contacts={contacts} segmentName={segment.name} />;
}
