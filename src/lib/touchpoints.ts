import { addDays, toWeekday } from "@/lib/scheduling";

/**
 * Warm-lead "touchpoint calendar". Warm leads (past clients) aren't on a fixed
 * N-day cadence — we reach out around moments that matter: tax deadlines, major
 * US holidays, and Muslim holidays (this is a tax/accounting practice).
 *
 * All dates are COMPUTED, not hardcoded — so the calendar never runs out:
 *   - US holidays: by rule (e.g. 4th Thursday of November).
 *   - Tax deadlines: the fixed nominal date, bumped to the next business day past
 *     weekends and federal holidays (incl. DC Emancipation Day, which is what
 *     actually shifts Tax Day).
 *   - Eid al-Fitr / al-Adha: derived from the Islamic Umm al-Qura calendar via the
 *     built-in Intl API. NOTE: Umm al-Qura is a calculated calendar; the actual
 *     observed Eid can still differ by ±1 day depending on local moon sighting.
 *
 * Tax deadlines generate THREE outreaches each (3 months, 2 months, and 2 weeks
 * before) so clients are nudged with runway. Holidays are a single greeting ~3
 * days before.
 */

export type TouchpointKind = "MUSLIM_HOLIDAY" | "US_HOLIDAY" | "TAX_DEADLINE";

export interface Touchpoint {
  /** the day we actually reach out (already offset before the event) */
  date: Date;
  /** the underlying event date (the holiday / filing deadline itself) */
  eventDate: Date;
  label: string;
  kind: TouchpointKind;
}

interface BaseEvent {
  date: Date;
  label: string;
}

// ---------- generic date helpers (local-midnight, matching scheduling.ts) ----------

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** The nth (1-based) given weekday in a month. weekday: 0=Sun … 6=Sat. */
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(year, month0, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month0, 1 + offset + (n - 1) * 7);
}

/** The last given weekday in a month. */
function lastWeekday(year: number, month0: number, weekday: number): Date {
  const last = new Date(year, month0 + 1, 0); // day 0 of next month = last day
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month0, last.getDate() - offset);
}

/** Federal observation of a FIXED-date holiday: Sat → Fri, Sun → Mon. */
function observed(d: Date): Date {
  if (d.getDay() === 6) return addDays(d, -1);
  if (d.getDay() === 0) return addDays(d, 1);
  return d;
}

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Set of federal-holiday day-keys for a year (observed), used to bump deadlines. */
function federalHolidayKeys(year: number): Set<string> {
  const days = [
    observed(new Date(year, 0, 1)), // New Year's Day
    nthWeekday(year, 0, 1, 3), // MLK Day — 3rd Mon Jan
    nthWeekday(year, 1, 1, 3), // Washington's Birthday — 3rd Mon Feb
    new Date(year, 3, 16), // DC Emancipation Day (Apr 16) — shifts IRS deadlines
    lastWeekday(year, 4, 1), // Memorial Day — last Mon May
    observed(new Date(year, 5, 19)), // Juneteenth
    observed(new Date(year, 6, 4)), // Independence Day
    nthWeekday(year, 8, 1, 1), // Labor Day — 1st Mon Sep
    nthWeekday(year, 9, 1, 2), // Columbus Day — 2nd Mon Oct
    observed(new Date(year, 10, 11)), // Veterans Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving — 4th Thu Nov
    observed(new Date(year, 11, 25)), // Christmas
  ];
  // Emancipation Day itself is also observed off weekends.
  days.push(observed(new Date(year, 3, 16)));
  return new Set(days.map(key));
}

/** Bump a deadline forward off weekends / federal holidays (IRS-style). */
function bumpDeadline(d: Date, holidays: Set<string>): Date {
  let out = d;
  while (isWeekend(out) || holidays.has(key(out))) out = addDays(out, 1);
  return out;
}

// ---------- event generators (per year) ----------

function usHolidays(year: number): BaseEvent[] {
  return [
    { date: new Date(year, 0, 1), label: "New Year" },
    { date: new Date(year, 6, 4), label: "Independence Day" },
    { date: nthWeekday(year, 10, 4, 4), label: "Thanksgiving" },
    { date: new Date(year, 11, 25), label: "Christmas" },
  ];
}

function taxDeadlines(year: number): BaseEvent[] {
  const h = federalHolidayKeys(year);
  const mk = (month0: number, day: number, label: string): BaseEvent => ({
    date: bumpDeadline(new Date(year, month0, day), h),
    label,
  });
  return [
    mk(0, 15, "Q4 estimated taxes"),
    mk(2, 15, "Business returns (S-corp/partnership)"),
    mk(3, 15, "Tax Day / Q1 estimated"),
    mk(5, 15, "Q2 estimated taxes"),
    mk(8, 15, "Q3 estimated / business extension"),
    mk(9, 15, "Individual extension deadline"),
  ];
}

// Eid is derived from the Umm al-Qura calendar; cache the (deterministic) scan per year.
const eidCache = new Map<number, BaseEvent[]>();

function eidHolidays(year: number): BaseEvent[] {
  const cached = eidCache.get(year);
  if (cached) return cached;

  const fmt = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    timeZone: "UTC",
  });
  const events: BaseEvent[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  while (cursor.getTime() <= end.getTime()) {
    const parts = fmt.formatToParts(cursor);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    // Convert the matched UTC calendar day to a local-midnight Date.
    const local = new Date(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
    if (month === 10 && day === 1) events.push({ date: local, label: "Eid al-Fitr" });
    else if (month === 12 && day === 10) events.push({ date: local, label: "Eid al-Adha" });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  eidCache.set(year, events);
  return events;
}

// ---------- touchpoint assembly ----------

// How far before a TAX deadline we reach out — one entry per outreach.
const TAX_OUTREACH: { offset: (e: Date) => Date; suffix: string }[] = [
  { offset: (e) => new Date(e.getFullYear(), e.getMonth() - 3, e.getDate()), suffix: "3-month heads-up" },
  { offset: (e) => new Date(e.getFullYear(), e.getMonth() - 2, e.getDate()), suffix: "2-month heads-up" },
  { offset: (e) => addDays(e, -14), suffix: "2-week reminder" },
];

const HOLIDAY_LEAD_DAYS = 3;

/** Build the ordered outreach list across a rolling window of years. */
function buildTouchpoints(years: number[]): Touchpoint[] {
  const out: Touchpoint[] = [];
  for (const year of years) {
    for (const e of taxDeadlines(year)) {
      for (const o of TAX_OUTREACH) {
        out.push({
          date: o.offset(e.date),
          eventDate: e.date,
          label: `${e.label} — ${o.suffix}`,
          kind: "TAX_DEADLINE",
        });
      }
    }
    for (const e of usHolidays(year)) {
      out.push({ date: addDays(e.date, -HOLIDAY_LEAD_DAYS), eventDate: e.date, label: e.label, kind: "US_HOLIDAY" });
    }
    for (const e of eidHolidays(year)) {
      out.push({ date: addDays(e.date, -HOLIDAY_LEAD_DAYS), eventDate: e.date, label: e.label, kind: "MUSLIM_HOLIDAY" });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Touchpoints for a 3-year window starting at `after`'s year (always has runway). */
function windowFrom(after: Date): Touchpoint[] {
  const y = after.getFullYear();
  return buildTouchpoints([y, y + 1, y + 2]);
}

/** The next outreach strictly after `after`. */
export function nextTouchpoint(after: Date = new Date()): Touchpoint | null {
  return windowFrom(after).find((t) => t.date.getTime() > after.getTime()) ?? null;
}

/**
 * Pick the next touchpoint to schedule and the date to schedule it for (the
 * outreach date, nudged off weekends).
 */
export function followUpForNextTouchpoint(
  after: Date = new Date(),
): { dueAt: Date; touchpoint: Touchpoint } | null {
  for (const t of windowFrom(after)) {
    const dueAt = toWeekday(t.date);
    if (dueAt.getTime() > after.getTime()) return { dueAt, touchpoint: t };
  }
  return null;
}
