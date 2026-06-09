"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { computeNextFollowUp } from "@/lib/scheduling";
import {
  ActivityType,
  CallOutcome,
  ContactStage,
  ReminderStatus,
  TranscriptProvider,
} from "@/generated/prisma/enums";

export interface LogCallInput {
  contactId: string;
  outcome: CallOutcome;
  note?: string;
  /** ISO date string — required (UI-enforced) for CALLBACK_REQUESTED */
  callbackDate?: string | null;
  transcript?: {
    text: string;
    segments?: unknown;
    durationMs?: number;
    provider?: TranscriptProvider;
  };
}

/**
 * Log a call outcome. Atomically:
 *  - creates a CALL Activity (with optional transcript),
 *  - updates the contact's status / lastContactedAt / nextFollowUpAt,
 *  - completes any open reminder and schedules the next one.
 */
export async function logCall(input: LogCallInput) {
  const user = await requireUser();

  const contact = await prisma.contact.findUnique({
    where: { id: input.contactId },
    select: { id: true, status: true, cadenceDays: true, ownerId: true, doNotCall: true },
  });
  if (!contact) throw new Error("Contact not found");

  const now = new Date();
  const explicitDate = input.callbackDate ? new Date(input.callbackDate) : null;

  // For no-contact outcomes (No Answer / Left Voicemail), count how many consecutive
  // no-contact attempts precede this call so the schedule can escalate (1d → 2d → 1wk → 2wk).
  // The two share one streak; any other outcome (e.g. Interested) resets it.
  const NO_CONTACT_OUTCOMES: CallOutcome[] = [
    CallOutcome.NO_ANSWER,
    CallOutcome.LEFT_VOICEMAIL,
    CallOutcome.VOICEMAIL_BROKEN,
  ];
  let noContactAttempt = 1;
  if (NO_CONTACT_OUTCOMES.includes(input.outcome)) {
    const recentCalls = await prisma.activity.findMany({
      where: { contactId: contact.id, type: ActivityType.CALL },
      orderBy: { createdAt: "desc" },
      select: { outcome: true },
      take: 20,
    });
    let priorStreak = 0;
    for (const a of recentCalls) {
      if (a.outcome && NO_CONTACT_OUTCOMES.includes(a.outcome)) priorStreak++;
      else break;
    }
    noContactAttempt = priorStreak + 1; // include the call being logged now
  }

  const schedule = computeNextFollowUp(
    input.outcome,
    contact.cadenceDays,
    now,
    explicitDate,
    noContactAttempt,
  );

  const reminderUserId = contact.ownerId ?? user.id;
  const hasTranscript = !!input.transcript && input.transcript.text.trim().length > 0;

  await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        type: ActivityType.CALL,
        outcome: input.outcome,
        note: input.note?.trim() || null,
        prevStatus: contact.status,
        newStatus: schedule.status,
        contactId: contact.id,
        userId: user.id,
        transcript: hasTranscript
          ? {
              create: {
                text: input.transcript!.text.trim(),
                segments: (input.transcript!.segments as object) ?? undefined,
                durationMs: input.transcript!.durationMs ?? null,
                provider: input.transcript!.provider ?? TranscriptProvider.WEB_SPEECH,
              },
            }
          : undefined,
      },
    });

    // Winning the job promotes the contact out of the cold pipeline into an
    // Active Client, and claims ownership (so it surfaces on the closer's
    // dashboard even if it was an unowned imported lead).
    const won = input.outcome === CallOutcome.CLOSED_WON;

    await tx.contact.update({
      where: { id: contact.id },
      data: {
        status: schedule.status,
        lastContactedAt: now,
        nextFollowUpAt: schedule.nextFollowUpAt,
        doNotCall: schedule.doNotCall || contact.doNotCall,
        ...(won
          ? { stage: ContactStage.ACTIVE_CLIENT, ownerId: contact.ownerId ?? user.id }
          : {}),
      },
    });

    // Close out any open reminders for this contact…
    await tx.reminder.updateMany({
      where: { contactId: contact.id, status: ReminderStatus.PENDING },
      data: { status: ReminderStatus.COMPLETED },
    });

    // …and schedule the next one if there's a follow-up date.
    if (schedule.nextFollowUpAt) {
      await tx.reminder.create({
        data: {
          contactId: contact.id,
          userId: reminderUserId,
          dueAt: schedule.nextFollowUpAt,
          status: ReminderStatus.PENDING,
        },
      });
    }

    return activity;
  });

  revalidatePath(`/contacts/${contact.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/contacts");
  revalidatePath("/active-clients"); // a CLOSED_WON lead now appears here
}

/**
 * Save a captured recording to the timeline as a NOTE, without logging a call
 * outcome. Used when the rep records but doesn't mark a status — the transcript
 * would otherwise be discarded. Deliberately does NOT touch status,
 * lastContactedAt, follow-up scheduling, or reminders: there's no outcome, so
 * nothing about where the contact sits in the pipeline should change.
 */
export async function saveTranscriptNote(input: {
  contactId: string;
  transcript: {
    text: string;
    segments?: unknown;
    durationMs?: number;
    provider?: TranscriptProvider;
  };
  note?: string;
}) {
  const user = await requireUser();
  const text = input.transcript.text.trim();
  if (!text) return;

  await prisma.activity.create({
    data: {
      type: ActivityType.NOTE,
      note: input.note?.trim() || null,
      contactId: input.contactId,
      userId: user.id,
      transcript: {
        create: {
          text,
          segments: (input.transcript.segments as object) ?? undefined,
          durationMs: input.transcript.durationMs ?? null,
          provider: input.transcript.provider ?? TranscriptProvider.WEB_SPEECH,
        },
      },
    },
  });

  revalidatePath(`/contacts/${input.contactId}`);
  revalidatePath("/contacts");
}

/** Add a freeform note (not a call) to a contact's timeline. */
export async function addNote(contactId: string, note: string) {
  const user = await requireUser();
  const trimmed = note.trim();
  if (!trimmed) return;

  await prisma.activity.create({
    data: {
      type: ActivityType.NOTE,
      note: trimmed,
      contactId,
      userId: user.id,
    },
  });
  revalidatePath(`/contacts/${contactId}`);
}
