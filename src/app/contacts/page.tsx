import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactStage, ContactStatus, ContactType } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { StageBadge } from "@/components/contacts/StageBadge";
import { CONTACT_STAGE_LABELS, CONTACT_STATUS_LABELS, CONTACT_TYPE_LABELS } from "@/lib/labels";
import { formatDue } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  status?: string;
  stage?: string;
  type?: string;
  segmentId?: string;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = await searchParams;

  const where: Prisma.ContactWhereInput = {};
  if (sp.q) {
    const q = sp.q.trim();
    const or: Prisma.ContactWhereInput[] = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ];

    // Phone-number search: stored numbers are formatted like "(512) 589-8019", so a
    // plain `contains` misses "5125898019" / "512-589". Strip everything but digits
    // from both sides and substring-match, so any format finds the contact.
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 3) {
      const matches = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Contact"
        WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}
      `;
      if (matches.length > 0) or.push({ id: { in: matches.map((m) => m.id) } });
    }

    where.OR = or;
  }
  if (sp.status) where.status = sp.status as ContactStatus;
  if (sp.stage) where.stage = sp.stage as ContactStage;
  if (sp.type) where.type = sp.type as ContactType;
  if (sp.segmentId) where.segments = { some: { segmentId: sp.segmentId } };

  const [contacts, segments] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 500,
    }),
    prisma.segment.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Contacts</h1>
        <Link
          href="/contacts/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + New contact
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          type="search"
          defaultValue={sp.q ?? ""}
          placeholder="Search by phone number, name, or company…"
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select name="stage" defaultValue={sp.stage ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All stages</option>
          {Object.entries(CONTACT_STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(CONTACT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All types</option>
          {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="segmentId" defaultValue={sp.segmentId ?? ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All lists</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Next follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No contacts found.
                </td>
              </tr>
            ) : (
              contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.company ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{CONTACT_TYPE_LABELS[c.type]}</td>
                  <td className="px-4 py-2"><StageBadge stage={c.stage} /></td>
                  <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2 text-slate-600">{formatDue(c.nextFollowUpAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">{contacts.length} contact(s)</p>
    </div>
  );
}
