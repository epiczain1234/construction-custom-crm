import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactForm } from "@/components/contacts/ContactForm";
import { updateContact } from "@/app/actions/contacts";

export const dynamic = "force-dynamic";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [contact, segments] = await Promise.all([
    prisma.contact.findUnique({
      where: { id },
      include: { segments: { select: { segmentId: true } } },
    }),
    prisma.segment.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/contacts/${id}`} className="text-sm text-slate-500 hover:underline">
        ← Back
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold text-slate-900">Edit contact</h1>
      <ContactForm
        action={updateContact.bind(null, id)}
        segments={segments}
        contact={contact}
        selectedSegmentIds={contact.segments.map((s) => s.segmentId)}
      />
    </div>
  );
}
