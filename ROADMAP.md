# Roadmap — Follow-up tasks

Planned work on top of the v1 CRM (contacts, lists, call mode, due-today dashboard,
live transcription). This file is the running plan; check items off as we build.

## Current state (what we can build on)

- **`Activity`** rows already capture every call: `type` (CALL/NOTE), `outcome`, `userId`,
  `contactId`, `createdAt`. This is the raw material for all call analytics — no schema
  change needed for counting calls.
- **`User`** = Zain + Alejandro, so "mine vs theirs" is just `groupBy userId`.
- **`Contact.nextFollowUpAt`** is the source of truth for what's due — already powering the
  home dashboard's overdue/today list (`src/app/dashboard/page.tsx` + `DueList`).
- Date helpers live in `src/lib/scheduling.ts` (`startOfDay`/`endOfDay`) and `src/lib/format.ts`.

---

## Task 1 — Analytics dashboard (calls overview)

**Goal:** an overview screen showing call volume over time and a head-to-head between Zain
and Alejandro, where each summary card expands (on click) into a detail page listing the
actual calls behind the number.

### Pages / components
- `src/app/dashboard/page.tsx` — extend the home dashboard (or add a new `/dashboard`
  "Overview" section above the due list) with a row of stat cards:
  - **Calls this week** (with week-over-week delta vs last week, e.g. "▲ 12% vs last week")
  - **Calls last week**
  - **My calls vs Alejandro's** — side-by-side counts for the current week
- `src/components/dashboard/StatCard.tsx` — reusable metric card: big number, label, optional
  WoW delta badge (green up / red down), clickable → links to the drill-down page.
- `src/components/dashboard/CallsByPersonBar.tsx` — simple two-bar comparison (Zain vs
  Alejandro) for the selected window; no chart lib needed, just flex/width divs.
- `src/components/dashboard/OutcomeBreakdown.tsx` — counts per `CallOutcome` for the window
  (No Answer / VM / Interested / …), reusing `CALL_OUTCOME_LABELS` from `src/lib/labels.ts`.
- **Drill-down page** `src/app/dashboard/calls/page.tsx` — reads query params
  `?range=this-week|last-week&user=<id|all>&outcome=<outcome>` and lists the matching
  `Activity` rows (contact name → link, outcome badge, who logged it, timestamp).
  This is the "expand on click" target for every card.

### Data layer
- `src/lib/analytics.ts` (new):
  - `startOfWeek(d)` / `endOfWeek(d)` (Monday-based; mirror the `startOfDay` style in
    `scheduling.ts`).
  - `getCallStats({ from, to })` → `{ total, byUser: Record<userId, count>, byOutcome }`
    using `prisma.activity.groupBy({ by: ['userId'], where: { type: 'CALL', createdAt: {gte,lt} } })`.
  - `weekOverWeek()` → this-week vs last-week totals + percentage delta.
- All queries filter `type: 'CALL'` and a `createdAt` range. No new tables.

### Acceptance criteria
- Cards show correct counts for this/last week and a WoW delta.
- Zain-vs-Alejandro comparison matches per-user call counts.
- Clicking any card opens `/dashboard/calls` pre-filtered and lists the real calls.
- Numbers reconcile with what's visible in each contact's activity timeline.

### Open questions
- Week starts Monday or Sunday? (defaulting to **Monday**.)
- Count a "call" as any `Activity` of type CALL regardless of outcome (incl. No Answer)?
  (defaulting to **yes** — it's still a dial.) Could add a "connected only" toggle later.

---

## Task 2 — Follow-up tracker page

**Goal:** a dedicated page for *everything* that needs a follow-up — broader than the home
dashboard's "due today/overdue", with grouping, filtering, and quick actions — so nothing
slips. Think of it as the team's shared task list driven by `Contact.nextFollowUpAt`.

### Pages / components
- `src/app/follow-ups/page.tsx` (new) + add **"Follow-ups"** to the top nav
  (`src/components/nav/TopNav.tsx`).
- Group the list into sections: **Overdue · Today · This week · Later**, each ordered by
  `nextFollowUpAt`. Reuse the existing `DueList` row UI (`src/components/dashboard/DueList.tsx`)
  or factor its row into a shared `FollowUpRow` so both the home dashboard and this page use it.
- **Filters** (querystring, like the contacts page): owner (Me / Alejandro / Everyone),
  list/segment, status, type.
- **Quick actions per row** (already have the server actions in `src/app/actions/reminders.ts`):
  snooze +1d / +7d, dismiss, click-to-call, and a "Log call" shortcut into call mode.

### Data layer
- Query `prisma.contact.findMany({ where: { nextFollowUpAt: { not: null }, ...filters },
  orderBy: { nextFollowUpAt: 'asc' } })`, then bucket into the four sections in the page using
  `startOfDay`/`endOfDay`/`endOfWeek`.
- Owner filter mirrors the dashboard's `OR: [{ownerId: me}, {ownerId: null}]` pattern but with
  an explicit "Everyone" option for the shared view.

### Acceptance criteria
- Every contact with a future or past `nextFollowUpAt` appears in the right bucket.
- Filtering by owner switches between my follow-ups, Alejandro's, and the whole team.
- Snooze/dismiss update immediately and keep the `Reminder` rows in sync (existing actions).
- Logging a call from here reschedules the follow-up and moves the row to its new bucket.

### Open questions
- Should "Everyone" be the default view, or "Me"? (defaulting to **Me**, with a toggle.)
- Include `CALLBACK` contacts as a highlighted sub-group? (probably yes — they're commitments.)

---

## Nice-to-haves spun off from the above (not scheduled)
- Tiny sparkline of daily calls for the last 14 days on the overview.
- "Streak" / calls-per-day target per person.
- Export the drill-down call list to CSV.
