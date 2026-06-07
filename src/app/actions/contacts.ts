"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContactStatus, ContactType } from "@/generated/prisma/enums";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
}

export async function createContact(formData: FormData) {
  const user = await requireUser();

  const firstName = str(formData.get("firstName"));
  if (!firstName) throw new Error("First name is required");

  const cadenceRaw = str(formData.get("cadenceDays"));
  const cadenceDays = cadenceRaw ? parseInt(cadenceRaw, 10) : null;
  const segmentIds = formData.getAll("segmentIds").filter((v): v is string => typeof v === "string");

  const contact = await prisma.contact.create({
    data: {
      firstName,
      lastName: str(formData.get("lastName")),
      company: str(formData.get("company")),
      title: str(formData.get("title")),
      phone: str(formData.get("phone")),
      email: str(formData.get("email")),
      notes: str(formData.get("notes")),
      type: (str(formData.get("type")) as ContactType) ?? ContactType.OTHER,
      cadenceDays: cadenceDays && cadenceDays > 0 ? cadenceDays : null,
      ownerId: user.id,
      segments: {
        create: segmentIds.map((segmentId) => ({ segmentId })),
      },
    },
  });

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContact(contactId: string, formData: FormData) {
  await requireUser();

  const firstName = str(formData.get("firstName"));
  if (!firstName) throw new Error("First name is required");

  const cadenceRaw = str(formData.get("cadenceDays"));
  const cadenceDays = cadenceRaw ? parseInt(cadenceRaw, 10) : null;

  // Manual overrides so a misclick (e.g. Wrong Number → Do-Not-Call) is recoverable.
  const doNotCall = formData.get("doNotCall") === "on";
  const nextRaw = str(formData.get("nextFollowUpAt"));
  const nextFollowUpAt = nextRaw ? new Date(nextRaw) : null;

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      firstName,
      lastName: str(formData.get("lastName")),
      company: str(formData.get("company")),
      title: str(formData.get("title")),
      phone: str(formData.get("phone")),
      email: str(formData.get("email")),
      notes: str(formData.get("notes")),
      type: (str(formData.get("type")) as ContactType) ?? ContactType.OTHER,
      status: (str(formData.get("status")) as ContactStatus) ?? undefined,
      cadenceDays: cadenceDays && cadenceDays > 0 ? cadenceDays : null,
      doNotCall,
      nextFollowUpAt,
    },
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  redirect(`/contacts/${contactId}`);
}

/** Toggle membership of a contact in a segment (used from contact detail / lists). */
export async function setSegmentMembership(
  contactId: string,
  segmentId: string,
  member: boolean,
) {
  await requireUser();
  if (member) {
    await prisma.contactSegment.upsert({
      where: { contactId_segmentId: { contactId, segmentId } },
      update: {},
      create: { contactId, segmentId },
    });
  } else {
    await prisma.contactSegment.deleteMany({ where: { contactId, segmentId } });
  }
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/lists/${segmentId}`);
}
