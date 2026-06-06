import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactForm } from "@/components/contacts/ContactForm";
import { createContact } from "@/app/actions/contacts";

export const dynamic = "force-dynamic";

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ segmentId?: string }>;
}) {
  await requireUser();
  const { segmentId } = await searchParams;
  const segments = await prisma.segment.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, visibility: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/contacts" className="text-sm text-slate-500 hover:underline">
        ← Contacts
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold text-slate-900">New contact</h1>
      <ContactForm
        action={createContact}
        segments={segments}
        selectedSegmentIds={segmentId ? [segmentId] : []}
      />
    </div>
  );
}
