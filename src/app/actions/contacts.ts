"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { addDays } from "@/lib/scheduling";
import { followUpForNextTouchpoint } from "@/lib/touchpoints";
import { ContactStage, ContactStatus, ContactType, ReminderStatus } from "@/generated/prisma/enums";

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

  // A client can be added straight into Warm/Active without ever passing through
  // cold calling. No CALL activity is created here, so the cold funnel is untouched.
  const stageRaw = str(formData.get("stage"));
  const stage = (Object.values(ContactStage) as string[]).includes(stageRaw ?? "")
    ? (stageRaw as ContactStage)
    : ContactStage.COLD_LEAD;

  // Warm/active contacts start with a scheduled follow-up (touchpoint / +3d) so
  // they immediately surface on the dashboard; cold leads are queued via lists.
  const now = new Date();
  let nextFollowUpAt: Date | null = null;
  if (stage === ContactStage.WARM_LEAD) {
    nextFollowUpAt = followUpForNextTouchpoint(now)?.dueAt ?? addDays(now, 90);
  } else if (stage === ContactStage.ACTIVE_CLIENT) {
    nextFollowUpAt = addDays(now, 3);
  }

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
      stage,
      cadenceDays: cadenceDays && cadenceDays > 0 ? cadenceDays : null,
      nextFollowUpAt,
      ownerId: user.id,
      segments: {
        create: segmentIds.map((segmentId) => ({ segmentId })),
      },
      reminders: nextFollowUpAt
        ? { create: { userId: user.id, dueAt: nextFollowUpAt, status: ReminderStatus.PENDING } }
        : undefined,
    },
  });

  revalidatePath("/contacts");
  revalidatePath("/dashboard");
  revalidatePath("/active-clients");
  revalidatePath("/warm-leads");
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
