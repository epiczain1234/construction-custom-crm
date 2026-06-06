import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SegmentCard } from "@/components/lists/SegmentCard";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await requireUser();

  // Everyone sees all lists; assignment decides whose queue they belong to.
  const segments = await prisma.segment.findMany({
    orderBy: { name: "asc" },
    include: {
      assignee: { select: { id: true, name: true } },
      _count: { select: { contacts: true } },
    },
  });

  const mine = segments.filter((s) => s.assigneeId === user.id);
  const others = segments.filter((s) => s.assigneeId && s.assigneeId !== user.id);
  const unassigned = segments.filter((s) => !s.assigneeId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Lists</h1>
        <Link
          href="/lists/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          + New list
        </Link>
      </div>

      <Section title="Assigned to me" empty="Nothing assigned to you yet.">
        {mine.map((s) => (
          <SegmentCard key={s.id} {...cardProps(s)} />
        ))}
      </Section>

      {others.length > 0 && (
        <Section title="Assigned to the team" empty="">
          {others.map((s) => (
            <SegmentCard key={s.id} {...cardProps(s)} />
          ))}
        </Section>
      )}

      <Section title="Unassigned" empty="">
        {unassigned.map((s) => (
          <SegmentCard key={s.id} {...cardProps(s)} />
        ))}
      </Section>
    </div>
  );
}

function cardProps(s: {
  id: string;
  name: string;
  description: string | null;
  assignee: { name: string } | null;
  _count: { contacts: number };
}) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    assigneeName: s.assignee?.name ?? null,
    count: s._count.contacts,
  };
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const hasItems = items.length > 0;
  if (!hasItems && !empty) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {hasItems ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      ) : (
        <p className="text-sm text-slate-400">{empty}</p>
      )}
    </section>
  );
}
