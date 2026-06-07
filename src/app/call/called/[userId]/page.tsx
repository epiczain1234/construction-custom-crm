import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ActivityType } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { CALL_OUTCOME_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CalledLeadsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const user = await requireUser();
  const { userId } = await params;

  // Reps can only see their own called leads; admins can see anyone's.
  if (!user.isAdmin && user.id !== userId) notFound();

  const person = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!person) notFound();

  // Contacts this person has logged at least one call on, with their most recent call.
  const contacts = await prisma.contact.findMany({
    where: { activities: { some: { type: ActivityType.CALL, userId } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      phone: true,
      status: true,
      activities: {
        where: { type: ActivityType.CALL, userId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { outcome: true, createdAt: true, note: true },
      },
    },
  });

  // Sort by most recent call (newest first).
  contacts.sort(
    (a, b) =>
      (b.activities[0]?.createdAt.getTime() ?? 0) - (a.activities[0]?.createdAt.getTime() ?? 0),
  );

  const label = person.name === user.name ? "Your" : `${person.name}'s`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/call" className="text-sm text-slate-500 hover:underline">
          ← Call mode
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{label} called leads</h1>
        <p className="text-sm text-slate-500">
          {contacts.length} lead{contacts.length === 1 ? "" : "s"} called so far.
        </p>
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No calls logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => {
            const last = c.activities[0];
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
            return (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-600"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium text-slate-900">{name}</h2>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {[c.company, c.phone].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium text-slate-600">
                    {last?.outcome ? CALL_OUTCOME_LABELS[last.outcome] : "Call"}
                  </div>
                  <div className="text-xs text-slate-400">{formatDateTime(last?.createdAt)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
