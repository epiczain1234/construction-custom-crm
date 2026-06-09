import { CallOutcome, ContactStatus } from "@/generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/** Push a date off the weekend onto the next Monday (Sat → +2, Sun → +1). */
export function toWeekday(d: Date): Date {
  const day = d.getDay(); // 0 = Sun … 6 = Sat
  if (day === 6) return addDays(d, 2);
  if (day === 0) return addDays(d, 1);
  return d;
}

// Escalating retry ladder for consecutive no-contact attempts (in days). A "no-contact"
// attempt is a No Answer or a Left Voicemail — both share this back-off, so leaving a
// voicemail doesn't restart the clock. Tight early, tapering toward give-up.
//   #1 +1d, #2 +2d, #3 +3d, #4 +5d, #5 +1wk, #6 +1wk, #7 +2wk  (8th = Dead, below)
const NO_CONTACT_LADDER_DAYS = [1, 2, 3, 5, 7, 7, 14];

function noContactDelayDays(attempt: number): number {
  const idx = Math.min(Math.max(attempt, 1), NO_CONTACT_LADDER_DAYS.length) - 1;
  return NO_CONTACT_LADDER_DAYS[idx];
}

// After this many consecutive no-contact attempts, stop the escalating ladder and
// write the lead off as Dead — then resurface it once after a long cooldown.
//   8 attempts ≈ industry "give-up" cutoff; 180-day (6mo) cooldown ≈ the long-cold
//   B2B re-engagement window (and catches a contractor in a new season/project).
const DEAD_AFTER_NO_CONTACT = 8;
const DEAD_COOLDOWN_DAYS = 180;

// On a win we promote the contact to an Active Client (handled in logCall) and
// schedule a near-term touch to start driving milestones (kickoff/docs) rather
// than going silent the way a cold-pipeline "Won" used to.
const ACTIVE_CLIENT_INITIAL_FOLLOWUP_DAYS = 3;

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
 * @param noContactAttempt how many consecutive no-contact attempts this is (No Answer or
 *                         Left Voicemail), 1-based incl. this call; drives the retry ladder
 */
export function computeNextFollowUp(
  outcome: CallOutcome,
  cadenceDays: number | null | undefined,
  now: Date = new Date(),
  explicitDate?: Date | null,
  noContactAttempt = 1,
): ScheduleResult {
  const cadence = cadenceDays && cadenceDays > 0 ? cadenceDays : null;

  switch (outcome) {
    // No Answer, Left Voicemail, and Voicemail Broken share one escalating ladder —
    // all three are "didn't reach them".
    case CallOutcome.NO_ANSWER:
    case CallOutcome.LEFT_VOICEMAIL:
    case CallOutcome.VOICEMAIL_BROKEN:
      // Given up after enough misses: mark Dead, then circle back once in ~6 months.
      if (noContactAttempt >= DEAD_AFTER_NO_CONTACT) {
        return {
          status: ContactStatus.DEAD,
          nextFollowUpAt: toWeekday(addDays(now, DEAD_COOLDOWN_DAYS)),
          doNotCall: false,
        };
      }
      return {
        status: ContactStatus.ATTEMPTING,
        nextFollowUpAt: toWeekday(addDays(now, noContactDelayDays(noContactAttempt))),
        doNotCall: false,
      };

    case CallOutcome.INTERESTED:
      // Caller picks the soonest callback (what the prospect asked for); fall back to +3d.
      return {
        status: ContactStatus.INTERESTED,
        nextFollowUpAt: explicitDate ?? toWeekday(addDays(now, cadence ?? 3)),
        doNotCall: false,
      };

    case CallOutcome.APPOINTMENT_SET:
      // An appointment has a specific time — the UI collects it (explicitDate).
      return {
        status: ContactStatus.INTERESTED,
        nextFollowUpAt: explicitDate ?? toWeekday(addDays(now, cadence ?? 3)),
        doNotCall: false,
      };

    case CallOutcome.CALLBACK_REQUESTED:
      return {
        status: ContactStatus.CALLBACK,
        // caller must supply the requested date; fall back to +1 day if missing
        nextFollowUpAt: explicitDate ?? toWeekday(addDays(now, 1)),
        doNotCall: false,
      };

    case CallOutcome.NOT_INTERESTED:
      // Respect the "no": mark Dead, no follow-up, and never call again (DNC/compliance).
      return {
        status: ContactStatus.DEAD,
        nextFollowUpAt: null,
        doNotCall: true,
      };

    case CallOutcome.WRONG_NUMBER:
      return { status: ContactStatus.DEAD, nextFollowUpAt: null, doNotCall: true };

    case CallOutcome.CLOSED_WON:
      // Status stays WON (accurate cold-pipeline disposition); logCall flips the
      // lifecycle stage to ACTIVE_CLIENT. Schedule a near-term follow-up so the
      // new client gets worked (milestones) instead of dropping off the radar.
      return {
        status: ContactStatus.WON,
        nextFollowUpAt: toWeekday(addDays(now, ACTIVE_CLIENT_INITIAL_FOLLOWUP_DAYS)),
        doNotCall: false,
      };

    default:
      return { status: ContactStatus.ATTEMPTING, nextFollowUpAt: toWeekday(addDays(now, cadence ?? 7)), doNotCall: false };
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
