"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { addDays } from "@/lib/scheduling";
import { ReminderStatus } from "@/generated/prisma/enums";

/**
 * Clear a contact's follow-up entirely (dismiss). Removes the due date and
 * closes any open reminder rows — it drops off the dashboard.
 */
export async function dismissFollowUp(contactId: string) {
  await requireUser();
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { nextFollowUpAt: null } }),
    prisma.reminder.updateMany({
      where: { contactId, status: ReminderStatus.PENDING },
      data: { status: ReminderStatus.DISMISSED },
    }),
  ]);
  revalidatePath("/dashboard");
  revalidatePath("/active-clients");
  revalidatePath("/warm-leads");
}

/** Push a contact's follow-up out by N days (default 1). Keeps reminder in sync. */
export async function snoozeFollowUp(contactId: string, days = 1) {
  const user = await requireUser();
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true },
  });
  const next = addDays(new Date(), days);

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contactId }, data: { nextFollowUpAt: next } });
    await tx.reminder.updateMany({
      where: { contactId, status: ReminderStatus.PENDING },
      data: { status: ReminderStatus.DISMISSED },
    });
    await tx.reminder.create({
      data: {
        contactId,
        userId: contact?.ownerId ?? user.id,
        dueAt: next,
        status: ReminderStatus.PENDING,
      },
    });
  });
  revalidatePath("/dashboard");
  revalidatePath("/active-clients");
  revalidatePath("/warm-leads");
}
