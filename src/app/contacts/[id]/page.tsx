import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { ActivityTimeline } from "@/components/contacts/ActivityTimeline";
import { PreviousNotes } from "@/components/contacts/PreviousNotes";
import { CallStatusButtons } from "@/components/call/CallStatusButtons";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { formatDue, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      segments: { include: { segment: { select: { id: true, name: true } } } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } }, transcript: { select: { text: true } } },
      },
    },
  });
  if (!contact) notFound();

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

  // Notes typed on earlier calls/notes — surfaced above "Log a call" for context.
  const previousNotes = contact.activities
    .filter((a) => a.note && a.note.trim())
    .map((a) => ({
      id: a.id,
      note: a.note as string,
      outcome: a.outcome,
      type: a.type,
      at: a.createdAt,
      by: a.user.name,
    }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/contacts" className="text-sm text-slate-500 hover:underline">
        ← Contacts
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{name}</h1>
            <StatusBadge status={contact.status} />
            {contact.doNotCall && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                Do not call
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {[contact.title, contact.company, CONTACT_TYPE_LABELS[contact.type]]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              📞 {contact.phone}
            </a>
          )}
          <Link
            href={`/contacts/${id}/edit`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <aside className="space-y-4 md:col-span-1">
          <InfoCard title="Details">
            <InfoRow label="Email" value={contact.email} />
            <InfoRow label="Owner" value={contact.owner?.name ?? "Unassigned"} />
            <InfoRow
              label="Cadence"
              value={contact.cadenceDays ? `Every ${contact.cadenceDays}d` : "None"}
            />
            <InfoRow label="Next follow-up" value={formatDue(contact.nextFollowUpAt)} />
            <InfoRow label="Last contacted" value={formatDate(contact.lastContactedAt)} />
          </InfoCard>

          <InfoCard title="Lists">
            {contact.segments.length === 0 ? (
              <p className="text-sm text-slate-400">None</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {contact.segments.map((cs) => (
                  <Link
                    key={cs.segment.id}
                    href={`/lists/${cs.segment.id}`}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                  >
                    {cs.segment.name}
                  </Link>
                ))}
              </div>
            )}
          </InfoCard>

          {contact.notes && (
            <InfoCard title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-600">{contact.notes}</p>
            </InfoCard>
          )}
        </aside>

        <div className="space-y-6 md:col-span-2">
          <PreviousNotes notes={previousNotes} />

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Log a call</h2>
            <CallStatusButtons contactId={contact.id} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Activity</h2>
            <ActivityTimeline activities={contact.activities} />
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700">{value || "—"}</span>
    </div>
  );
}
