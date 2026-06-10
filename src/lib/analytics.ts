import { prisma } from "@/lib/prisma";
import { ActivityType, CallOutcome } from "@/generated/prisma/enums";

/** The company name shown against the benchmark on the dashboard. */
export const COMPANY_NAME = "Alexander & Associates";

/**
 * Benchmark funnel for B2B (cold-list) tax prospecting, as a fraction of dials.
 * Sourced from 2025 cold-calling benchmarks:
 *  - connect rate ~16% (≈166 live answers / 1,000 dials)
 *  - dial→appointment ~2.5% average (1 meeting per ~40 dials; cold lists 1.5–2%)
 *  - interested sits between the two
 * Tweak these to set your own targets.
 */
export const BENCHMARK = {
  connected: 0.16,
  interested: 0.06,
  appointment: 0.025,
};

/** Back-compat: the headline conversion benchmark (appointments ÷ dials). */
export const BENCHMARK_CONVERSION = BENCHMARK.appointment;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  x.setDate(x.getDate() + diff);
  return x;
}

export interface WeekStats {
  calls: number; // distinct contacts called this week (each counted by its latest outcome)
  connected: number; // reached a human
  interested: number; // interested or better
  appointments: number;
  won: number;
  follows: number; // follow-up outreaches: repeat dials + warm "Log touch" touches
}

/** One contact's most recent CALL in a window: the outcome that "counts" + who logged it. */
type LatestCall = { contactId: string; outcome: CallOutcome | null; userId: string };

/**
 * Collapse a window's CALL activities down to the latest one per contact.
 * Logging an outcome is append-only — the full call history stays on the
 * contact's timeline — but metrics count each contact once, by their most
 * recent outcome. So a misclick that's corrected by a later outcome (e.g.
 * Not Interested → Wrong Number) no longer double-counts the dial or leaves a
 * stale "connected" on the dashboard.
 */
async function latestCallPerContact(gte: Date, lt?: Date): Promise<LatestCall[]> {
  const activities = await prisma.activity.findMany({
    where: { type: ActivityType.CALL, createdAt: { gte, ...(lt ? { lt } : {}) } },
    orderBy: { createdAt: "desc" },
    select: { contactId: true, outcome: true, userId: true },
  });
  const seen = new Set<string>();
  const latest: LatestCall[] = [];
  for (const a of activities) {
    if (seen.has(a.contactId)) continue; // ordered newest-first → first hit is the latest
    seen.add(a.contactId);
    latest.push(a);
  }
  return latest;
}

function tally(calls: LatestCall[]): Omit<WeekStats, "follows"> {
  const c = (o: CallOutcome) => calls.filter((x) => x.outcome === o).length;
  const appointments = c(CallOutcome.APPOINTMENT_SET);
  const won = c(CallOutcome.CLOSED_WON);
  const interested = c(CallOutcome.INTERESTED) + appointments + won;
  const connected =
    interested + c(CallOutcome.NOT_INTERESTED) + c(CallOutcome.CALLBACK_REQUESTED);
  return { calls: calls.length, connected, interested, appointments, won };
}

/**
 * Follow-up outreaches in a window: a "follow" is either a repeat dial (a CALL on
 * a contact that already had an earlier CALL) or a warm-lead TOUCH ("Log touch").
 * Counted as events (a lead followed up twice = 2), unlike `calls` which de-dupes
 * to one per contact.
 */
async function countFollows(gte: Date, lt?: Date): Promise<number> {
  const range = { gte, ...(lt ? { lt } : {}) };

  const windowCalls = await prisma.activity.findMany({
    where: { type: ActivityType.CALL, createdAt: range },
    select: { contactId: true, createdAt: true },
  });
  let repeatDials = 0;
  if (windowCalls.length) {
    const ids = [...new Set(windowCalls.map((c) => c.contactId))];
    const firsts = await prisma.activity.groupBy({
      by: ["contactId"],
      where: { type: ActivityType.CALL, contactId: { in: ids } },
      _min: { createdAt: true },
    });
    const firstAt = new Map(firsts.map((f) => [f.contactId, f._min.createdAt?.getTime() ?? 0]));
    // A window CALL is a "repeat" if the contact had any earlier CALL than this one.
    repeatDials = windowCalls.filter((c) => (firstAt.get(c.contactId) ?? 0) < c.createdAt.getTime()).length;
  }

  const touches = await prisma.activity.count({
    where: { type: ActivityType.TOUCH, createdAt: range },
  });

  return repeatDials + touches;
}

export interface WeeklyAnalytics {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  /** appointments ÷ calls, this week */
  conversion: number;
  benchmark: number;
}

/**
 * Company-wide (all users) call metrics for this week vs last week, plus the
 * funnel counts. Driven entirely by CALL activities + their outcomes.
 */
export async function getWeeklyAnalytics(now: Date = new Date()): Promise<WeeklyAnalytics> {
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - WEEK_MS);

  const [thisCalls, lastCalls, thisFollows, lastFollows] = await Promise.all([
    latestCallPerContact(thisWeekStart),
    latestCallPerContact(lastWeekStart, thisWeekStart),
    countFollows(thisWeekStart),
    countFollows(lastWeekStart, thisWeekStart),
  ]);

  const thisWeek: WeekStats = { ...tally(thisCalls), follows: thisFollows };
  const lastWeek: WeekStats = { ...tally(lastCalls), follows: lastFollows };
  const conversion = thisWeek.calls ? thisWeek.appointments / thisWeek.calls : 0;

  return { thisWeek, lastWeek, conversion, benchmark: BENCHMARK_CONVERSION };
}

/** Percent change this vs last; null when last is 0 (avoid divide-by-zero). */
export function weekOverWeek(thisVal: number, lastVal: number): number | null {
  if (lastVal === 0) return null;
  return (thisVal - lastVal) / lastVal;
}

export interface PersonWeekStats {
  userId: string;
  name: string;
  calls: number;
  appointments: number;
}

/**
 * Per-person head-to-head for this week: calls made and appointments set, one row
 * per user. Two grouped CALL queries (by userId), joined to the user list so people
 * with zero activity still show up.
 */
export async function getPerPersonWeekly(now: Date = new Date()): Promise<PersonWeekStats[]> {
  const thisWeekStart = startOfWeek(now);

  // Same latest-per-contact basis as the funnel, so the leaderboard totals can't
  // diverge from the headline numbers. A contact is credited to whoever logged
  // its most recent call this week.
  const [users, latest] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    latestCallPerContact(thisWeekStart),
  ]);

  const callsBy = new Map<string, number>();
  const apptBy = new Map<string, number>();
  for (const a of latest) {
    callsBy.set(a.userId, (callsBy.get(a.userId) ?? 0) + 1);
    if (a.outcome === CallOutcome.APPOINTMENT_SET) {
      apptBy.set(a.userId, (apptBy.get(a.userId) ?? 0) + 1);
    }
  }

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    calls: callsBy.get(u.id) ?? 0,
    appointments: apptBy.get(u.id) ?? 0,
  }));
}
