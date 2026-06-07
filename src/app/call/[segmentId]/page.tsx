import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { endOfDay } from "@/lib/scheduling";
import { ContactStatus } from "@/generated/prisma/enums";
import { CallModeClient, type CallContact } from "@/components/call/CallModeClient";

export const dynamic = "force-dynamic";

// Contacts in these states are done — never queue them for calling.
const TERMINAL_STATUSES: ContactStatus[] = [ContactStatus.WON, ContactStatus.DEAD];

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

  const now = new Date();
  const endToday = endOfDay(now);

  // Eligible = on the list, not do-not-call, not already won/dead.
  const eligible = segment.contacts
    .map((cs) => cs.contact)
    .filter((c) => !c.doNotCall && !TERMINAL_STATUSES.includes(c.status));

  const toCallContact = (c: (typeof eligible)[number]): CallContact => ({
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
  });

  // Callable now = never contacted (no follow-up date) or due today/overdue.
  const callable = eligible.filter((c) => !c.nextFollowUpAt || c.nextFollowUpAt <= endToday);
  // Waiting = scheduled for a future date — don't call yet, but show the count.
  const waiting = eligible.filter((c) => c.nextFollowUpAt && c.nextFollowUpAt > endToday);

  const soonestWaiting = waiting.reduce<Date | null>((min, c) => {
    const d = c.nextFollowUpAt!;
    return !min || d < min ? d : min;
  }, null);

  return (
    <CallModeClient
      contacts={callable.map(toCallContact)}
      segmentName={segment.name}
      waitingCount={waiting.length}
      soonestWaiting={soonestWaiting?.toISOString() ?? null}
    />
  );
}
