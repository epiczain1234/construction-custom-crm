"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { addDays } from "@/lib/scheduling";
import { followUpForNextTouchpoint } from "@/lib/touchpoints";
import { CONTACT_STAGE_LABELS, MILESTONE_LABELS, type MilestoneKey } from "@/lib/labels";
import { ActivityType, ContactStage, ContactStatus, ReminderStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

// When the touchpoint calendar is exhausted (past the curated table), fall back
// to a fixed ~quarterly cadence so warm leads never go un-scheduled.
const TOUCHPOINT_FALLBACK_DAYS = 90;

function revalidateLifecycle(contactId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/active-clients");
  revalidatePath("/warm-leads");
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
}

/** The next warm-lead follow-up date (calendar touchpoint, or fixed fallback). */
function nextWarmFollowUp(now: Date): Date {
  return followUpForNextTouchpoint(now)?.dueAt ?? addDays(now, TOUCHPOINT_FALLBACK_DAYS);
}

/**
 * Swap a contact's open reminder for a new one. Keeps the dismiss-then-create
 * invariant identical across every lifecycle action (avoids orphaned PENDING rows).
 * `dueAt` null just closes the open reminder without scheduling a replacement.
 */
async function replacePendingReminder(
  tx: Prisma.TransactionClient,
  opts: { contactId: string; userId: string; dueAt: Date | null; closeStatus?: ReminderStatus },
) {
  await tx.reminder.updateMany({
    where: { contactId: opts.contactId, status: ReminderStatus.PENDING },
    data: { status: opts.closeStatus ?? ReminderStatus.DISMISSED },
  });
  if (opts.dueAt) {
    await tx.reminder.create({
      data: {
        contactId: opts.contactId,
        userId: opts.userId,
        dueAt: opts.dueAt,
        status: ReminderStatus.PENDING,
      },
    });
  }
}

/**
 * Manually move a contact between lifecycle stages. Claims ownership (so it shows
 * on the mover's dashboard) and, when a stage that expects follow-ups has none,
 * schedules an appropriate one (touchpoint for warm, +3d for active).
 */
export async function setContactStage(contactId: string, stage: ContactStage) {
  const user = await requireUser();
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true, nextFollowUpAt: true, stage: true },
  });
  if (!contact) throw new Error("Contact not found");
  if (contact.stage === stage) return;

  const now = new Date();
  const ownerId = contact.ownerId ?? user.id;

  // Only (re)schedule when moving into a follow-up-driven stage that has no date yet.
  let newFollowUp: Date | undefined;
  if (!contact.nextFollowUpAt) {
    if (stage === ContactStage.WARM_LEAD) newFollowUp = nextWarmFollowUp(now);
    else if (stage === ContactStage.ACTIVE_CLIENT) newFollowUp = addDays(now, 3);
  }

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contactId },
      data: { stage, ownerId, ...(newFollowUp ? { nextFollowUpAt: newFollowUp } : {}) },
    });
    await tx.activity.create({
      data: {
        type: ActivityType.STATUS_CHANGE,
        note: `Stage → ${CONTACT_STAGE_LABELS[stage]}`,
        contactId,
        userId: user.id,
      },
    });
    if (newFollowUp) {
      await replacePendingReminder(tx, { contactId, userId: ownerId, dueAt: newFollowUp });
    }
  });

  revalidateLifecycle(contactId);
}

/** Typed milestone-column update (avoids stringly-typed Prisma data). */
function milestoneData(key: MilestoneKey, value: Date | null): Prisma.ContactUpdateInput {
  switch (key) {
    case "DOCS":
      return { milestoneDocsFilledAt: value };
    case "PAYMENT":
      return { milestonePaymentCollectedAt: value };
    case "KICKOFF":
      return { milestoneKickoffScheduledAt: value };
    case "FINISHED_SERVING":
      return { milestoneFinishedServingAt: value };
  }
}

/**
 * Toggle an active-client milestone. Checking "Finished serving" is the headline
 * transition: it promotes the contact to a Warm Lead and schedules the next
 * touchpoint. Unchecking it only clears the timestamp — it does NOT auto-revert
 * the stage (touchpoints may have advanced since).
 */
export async function setMilestone(contactId: string, key: MilestoneKey, done: boolean) {
  const user = await requireUser();
  const now = new Date();
  const value = done ? now : null;

  const finishingService = key === "FINISHED_SERVING" && done;

  if (!finishingService) {
    await prisma.contact.update({ where: { id: contactId }, data: milestoneData(key, value) });
    revalidateLifecycle(contactId);
    return;
  }

  // Finished serving → become a warm lead on the touchpoint cadence.
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true },
  });
  const ownerId = contact?.ownerId ?? user.id;
  const dueAt = nextWarmFollowUp(now);

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: contactId },
      data: {
        ...milestoneData(key, value),
        stage: ContactStage.WARM_LEAD,
        owner: { connect: { id: ownerId } },
        nextFollowUpAt: dueAt,
      },
    });
    await tx.activity.create({
      data: {
        type: ActivityType.STATUS_CHANGE,
        note: `${MILESTONE_LABELS.FINISHED_SERVING} → ${CONTACT_STAGE_LABELS.WARM_LEAD}`,
        contactId,
        userId: user.id,
      },
    });
    await replacePendingReminder(tx, {
      contactId,
      userId: ownerId,
      dueAt,
      closeStatus: ReminderStatus.COMPLETED,
    });
  });

  revalidateLifecycle(contactId);
}

/**
 * Warm-lead "log a touch": record an outreach note, stamp lastContactedAt, and
 * advance the follow-up to the next touchpoint. Stays in WARM_LEAD.
 */
export async function logWarmTouch(contactId: string, note?: string) {
  const user = await requireUser();
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true },
  });
  const ownerId = contact?.ownerId ?? user.id;
  const now = new Date();
  const dueAt = nextWarmFollowUp(now);

  await prisma.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        type: ActivityType.TOUCH,
        note: note?.trim() || "Touched base (warm lead)",
        contactId,
        userId: user.id,
      },
    });
    await tx.contact.update({
      where: { id: contactId },
      data: { lastContactedAt: now, nextFollowUpAt: dueAt },
    });
    await replacePendingReminder(tx, {
      contactId,
      userId: ownerId,
      dueAt,
      closeStatus: ReminderStatus.COMPLETED,
    });
  });

  revalidateLifecycle(contactId);
}

/** Set/override the next follow-up date for any stage (manual date pick). */
export async function scheduleFollowUp(contactId: string, dueAtISO: string) {
  const user = await requireUser();
  const dueAt = new Date(dueAtISO);
  if (Number.isNaN(dueAt.getTime())) throw new Error("Invalid date");
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true },
  });
  const ownerId = contact?.ownerId ?? user.id;

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contactId }, data: { nextFollowUpAt: dueAt } });
    await replacePendingReminder(tx, { contactId, userId: ownerId, dueAt });
  });

  revalidateLifecycle(contactId);
}

/**
 * Mark a warm lead dead (or revive it). Dead keeps it in the Warm Leads list
 * (visible, dimmed) but stops scheduling: status DEAD, doNotCall, no follow-up,
 * open reminders closed. Reviving re-enables it on the touchpoint cadence.
 */
export async function setWarmLeadDead(contactId: string, dead: boolean) {
  const user = await requireUser();
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true },
  });
  const ownerId = contact?.ownerId ?? user.id;

  await prisma.$transaction(async (tx) => {
    if (dead) {
      await tx.contact.update({
        where: { id: contactId },
        data: { status: ContactStatus.DEAD, doNotCall: true, nextFollowUpAt: null },
      });
      await replacePendingReminder(tx, { contactId, userId: ownerId, dueAt: null });
      await tx.activity.create({
        data: {
          type: ActivityType.STATUS_CHANGE,
          note: "Marked dead (warm lead)",
          newStatus: ContactStatus.DEAD,
          contactId,
          userId: user.id,
        },
      });
    } else {
      const dueAt = nextWarmFollowUp(new Date());
      await tx.contact.update({
        where: { id: contactId },
        data: { status: ContactStatus.NEW, doNotCall: false, nextFollowUpAt: dueAt },
      });
      await replacePendingReminder(tx, { contactId, userId: ownerId, dueAt });
      await tx.activity.create({
        data: {
          type: ActivityType.STATUS_CHANGE,
          note: "Revived (warm lead)",
          contactId,
          userId: user.id,
        },
      });
    }
  });

  revalidateLifecycle(contactId);
}

/** One-click: schedule the next calendar touchpoint for a warm lead. */
export async function scheduleNextTouchpoint(contactId: string) {
  const user = await requireUser();
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { ownerId: true },
  });
  const ownerId = contact?.ownerId ?? user.id;
  const dueAt = nextWarmFollowUp(new Date());

  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contactId }, data: { nextFollowUpAt: dueAt } });
    await replacePendingReminder(tx, { contactId, userId: ownerId, dueAt });
  });

  revalidateLifecycle(contactId);
}
