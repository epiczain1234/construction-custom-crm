import { prisma } from "@/lib/prisma";
import { ActivityType, CallOutcome } from "@/generated/prisma/enums";

/** Industry cold-calling benchmark: ~3% of dials become a booked appointment. */
export const BENCHMARK_CONVERSION = 0.03;

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
  calls: number;
  connected: number; // reached a human
  interested: number; // interested or better
  appointments: number;
  won: number;
}

type GroupRow = { outcome: CallOutcome | null; _count: { _all: number } };

function tally(rows: GroupRow[]): WeekStats {
  const c = (o: CallOutcome) => rows.find((r) => r.outcome === o)?._count._all ?? 0;
  const calls = rows.reduce((sum, r) => sum + r._count._all, 0);
  const appointments = c(CallOutcome.APPOINTMENT_SET);
  const won = c(CallOutcome.CLOSED_WON);
  const interested = c(CallOutcome.INTERESTED) + appointments + won;
  const connected =
    interested + c(CallOutcome.NOT_INTERESTED) + c(CallOutcome.CALLBACK_REQUESTED);
  return { calls, connected, interested, appointments, won };
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

  const [thisRows, lastRows] = await Promise.all([
    prisma.activity.groupBy({
      by: ["outcome"],
      where: { type: ActivityType.CALL, createdAt: { gte: thisWeekStart } },
      _count: { _all: true },
    }),
    prisma.activity.groupBy({
      by: ["outcome"],
      where: { type: ActivityType.CALL, createdAt: { gte: lastWeekStart, lt: thisWeekStart } },
      _count: { _all: true },
    }),
  ]);

  const thisWeek = tally(thisRows);
  const lastWeek = tally(lastRows);
  const conversion = thisWeek.calls ? thisWeek.appointments / thisWeek.calls : 0;

  return { thisWeek, lastWeek, conversion, benchmark: BENCHMARK_CONVERSION };
}

/** Percent change this vs last; null when last is 0 (avoid divide-by-zero). */
export function weekOverWeek(thisVal: number, lastVal: number): number | null {
  if (lastVal === 0) return null;
  return (thisVal - lastVal) / lastVal;
}
