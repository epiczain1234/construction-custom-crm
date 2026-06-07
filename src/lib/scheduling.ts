import { CallOutcome, ContactStatus } from "@/generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

export interface ScheduleResult {
  status: ContactStatus;
  nextFollowUpAt: Date | null;
  doNotCall: boolean;
}

/**
 * Given a call outcome (and the contact's default cadence), decide the new
 * status and when the next follow-up is due. This is the single place that
 * encodes the follow-up rhythm — tweak the day values here to retune.
 *
 * @param outcome      the outcome button the user tapped
 * @param cadenceDays  the contact's configured cadence (days), if any
 * @param now          reference "now" (injectable for testing/server time)
 * @param explicitDate required for CALLBACK_REQUESTED — the date the contact asked for
 */
export function computeNextFollowUp(
  outcome: CallOutcome,
  cadenceDays: number | null | undefined,
  now: Date = new Date(),
  explicitDate?: Date | null,
): ScheduleResult {
  const cadence = cadenceDays && cadenceDays > 0 ? cadenceDays : null;

  switch (outcome) {
    case CallOutcome.NO_ANSWER:
      return { status: ContactStatus.ATTEMPTING, nextFollowUpAt: addDays(now, 1), doNotCall: false };

    case CallOutcome.LEFT_VOICEMAIL:
      return { status: ContactStatus.ATTEMPTING, nextFollowUpAt: addDays(now, 2), doNotCall: false };

    case CallOutcome.INTERESTED:
      return {
        status: ContactStatus.INTERESTED,
        nextFollowUpAt: addDays(now, cadence ?? 3),
        doNotCall: false,
      };

    case CallOutcome.APPOINTMENT_SET:
      // An appointment has a specific time — the UI collects it (explicitDate).
      return {
        status: ContactStatus.INTERESTED,
        nextFollowUpAt: explicitDate ?? addDays(now, cadence ?? 3),
        doNotCall: false,
      };

    case CallOutcome.CALLBACK_REQUESTED:
      return {
        status: ContactStatus.CALLBACK,
        // caller must supply the requested date; fall back to +1 day if missing
        nextFollowUpAt: explicitDate ?? addDays(now, 1),
        doNotCall: false,
      };

    case CallOutcome.NOT_INTERESTED:
      // park it for a year — circle back next year, ignore any short cadence
      return {
        status: ContactStatus.NOT_INTERESTED,
        nextFollowUpAt: addDays(now, 365),
        doNotCall: false,
      };

    case CallOutcome.WRONG_NUMBER:
      return { status: ContactStatus.DEAD, nextFollowUpAt: null, doNotCall: true };

    case CallOutcome.CLOSED_WON:
      return { status: ContactStatus.WON, nextFollowUpAt: null, doNotCall: false };

    default:
      return { status: ContactStatus.ATTEMPTING, nextFollowUpAt: addDays(now, cadence ?? 7), doNotCall: false };
  }
}

/** True if a follow-up date is due (today or overdue) relative to `now`. */
export function isDue(date: Date | null | undefined, now: Date = new Date()): boolean {
  if (!date) return false;
  return date.getTime() <= endOfDay(now).getTime();
}

/** True if a follow-up date is strictly before the start of today. */
export function isOverdue(date: Date | null | undefined, now: Date = new Date()): boolean {
  if (!date) return false;
  return date.getTime() < startOfDay(now).getTime();
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
