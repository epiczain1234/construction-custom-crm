import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { AddToListForm } from "@/components/lists/AddToListForm";
import { AssigneeSelect } from "@/components/lists/AssigneeSelect";
import { setSegmentMembership } from "@/app/actions/contacts";
import { deleteSegment } from "@/app/actions/segments";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { formatDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // Independent queries — run them in one parallel round-trip.
  const [segment, allContacts, users] = await Promise.all([
    prisma.segment.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        contacts: {
          include: { contact: true },
          orderBy: { contact: { nextFollowUpAt: { sort: "asc", nulls: "last" } } },
        },
      },
    }),
    prisma.contact.findMany({
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true, company: true },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!segment) notFound();

  // Contacts not yet on this list, for the add picker.
  const memberIds = new Set(segment.contacts.map((cs) => cs.contactId));
  const candidates = allContacts
    .filter((c) => !memberIds.has(c.id))
    .map((c) => ({
      id: c.id,
      label:
        [c.firstName, c.lastName].filter(Boolean).join(" ") +
        (c.company ? ` — ${c.company}` : ""),
    }));

  const isOwner = segment.ownerId === user.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/lists" className="text-sm text-slate-500 hover:underline">
        ← Lists
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{segment.name}</h1>
          {segment.description && (
            <p className="text-sm text-slate-500">{segment.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <span className="text-xs uppercase tracking-wide text-slate-400">Assigned to</span>
            <AssigneeSelect segmentId={segment.id} assigneeId={segment.assigneeId} users={users} />
          </div>
          <p className="mt-1 text-xs text-slate-400">Created by {segment.owner.name}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {segment.contacts.length > 0 && (
            <Link
              href={`/call/${segment.id}`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Start calling →
            </Link>
          )}
          {isOwner && (
            <form action={deleteSegment.bind(null, segment.id)}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600"
              >
                Delete
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <AddToListForm segmentId={segment.id} candidates={candidates} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Follow-up</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {segment.contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No contacts on this list yet.
                </td>
              </tr>
            ) : (
              segment.contacts.map(({ contact: c }) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.company ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{CONTACT_TYPE_LABELS[c.type]}</td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2 text-slate-600">{formatDue(c.nextFollowUpAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={setSegmentMembership.bind(null, c.id, segment.id, false)}>
                      <button
                        type="submit"
                        className="text-xs text-slate-400 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
