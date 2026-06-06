import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { SegmentVisibility } from "@/generated/prisma/enums";
import { SegmentCard } from "@/components/lists/SegmentCard";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const user = await requireUser();

  // Visible lists: mine (any visibility) + everyone's SHARED lists.
  const segments = await prisma.segment.findMany({
    where: {
      OR: [{ ownerId: user.id }, { visibility: SegmentVisibility.SHARED }],
    },
    orderBy: { name: "asc" },
    include: {
      owner: { select: { name: true } },
      _count: { select: { contacts: true } },
    },
  });

  const mine = segments.filter((s) => s.ownerId === user.id);
  const shared = segments.filter((s) => s.ownerId !== user.id);

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

      <Section title="My lists" empty="You haven't made any lists yet.">
        {mine.map((s) => (
          <SegmentCard
            key={s.id}
            id={s.id}
            name={s.name}
            description={s.description}
            visibility={s.visibility}
            ownerName={s.owner.name}
            count={s._count.contacts}
          />
        ))}
      </Section>

      {shared.length > 0 && (
        <Section title="Shared lists" empty="">
          {shared.map((s) => (
            <SegmentCard
              key={s.id}
              id={s.id}
              name={s.name}
              description={s.description}
              visibility={s.visibility}
              ownerName={s.owner.name}
              count={s._count.contacts}
            />
          ))}
        </Section>
      )}
    </div>
  );
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
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean) && items.length > 0;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      {hasItems ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      ) : empty ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : null}
    </section>
  );
}
