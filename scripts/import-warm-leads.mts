/**
 * Import Zain's warm-lead spreadsheet ("Form15 Warm Leads.xlsx") into the CRM as
 * real Warm Leads (Contact.stage = WARM_LEAD) owned by Zain.
 *
 *   DRY_RUN=1 npx tsx scripts/import-warm-leads.mts            # preview, no writes
 *            npx tsx scripts/import-warm-leads.mts             # live load
 *            npx tsx scripts/import-warm-leads.mts "/path.xlsx"
 *
 * Only the "In-person Events" and "Friends & Extended Circle" tabs are imported
 * (the CPA/Form15 tab is intentionally skipped). No phone numbers exist in the
 * sheet — the contact channel is folded into notes ("Source: …"). Each lead gets
 * a first follow-up spread evenly (~12/week, weekdays) starting two weeks out, so
 * they don't all come due at once. Idempotent: skips a lead already present as one
 * of Zain's warm leads (matched on first+last name).
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConfig } from "../src/lib/pg-config";
import { ContactStage, ContactType, ReminderStatus } from "../src/generated/prisma/enums";

const XLSX = process.argv[2] ?? `${process.env.HOME}/Downloads/Form15 Warm Leads .xlsx`;
const ZAIN_EMAIL = "mukatizain@gmail.com";
const DRY_RUN = process.env.DRY_RUN === "1";
const PER_WEEK = 12;

const ents = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, " ")
    .replace(/&#x?[0-9a-fA-F]+;/g, " ")
    .replace(/&amp;/g, "&");

const read = (entry: string) =>
  execFileSync("unzip", ["-p", XLSX, entry], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// shared strings
const ss: string[] = [];
for (const m of read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  ss.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => ents(x[1])).join(""));
}

const colNum = (ref: string) => {
  const c = ref.match(/^[A-Z]+/)![0];
  let n = 0;
  for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function parseSheet(file: string): string[][] {
  const xml = read(`xl/worksheets/${file}`);
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cm of rm[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const t = (cm[2].match(/t="([^"]+)"/) || [])[1];
      let val = "";
      if (t === "inlineStr") val = [...cm[3].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => ents(x[1])).join("");
      else {
        const v = (cm[3].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (v !== undefined) val = t === "s" ? ss[+v] ?? "" : ents(v);
      }
      cells[colNum(cm[1])] = val;
    }
    rows.push(cells);
  }
  return rows;
}

const clean = (v: string | undefined) => {
  const s = (v ?? "").trim();
  return s.length ? s : null;
};

function splitName(name: string): { firstName: string; lastName: string | null } {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() || name.trim();
  return { firstName, lastName: parts.length ? parts.join(" ") : null };
}

const addDays = (from: Date, days: number) =>
  new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);

// Monday of the current week, then push two weeks out (skip this week + next).
function startMonday(now: Date): Date {
  const dow = now.getDay(); // 0 Sun … 6 Sat
  const monday = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), dow === 0 ? -6 : 1 - dow);
  return addDays(monday, 14);
}

// Spread: ~PER_WEEK per week across Mon–Fri, evenly peppered.
function spreadDate(start: Date, i: number): Date {
  const week = Math.floor(i / PER_WEEK);
  const weekday = (i % PER_WEEK) % 5; // 0=Mon … 4=Fri
  return addDays(start, week * 7 + weekday);
}

interface Mapped {
  firstName: string;
  lastName: string | null;
  title: string | null;
  notes: string | null;
}

// sheet file → (group label, column index map). Sheet1 has a duplicate Contact Info col.
const SHEETS = [
  { file: "sheet1.xml", group: "In-person Events", c: { name: 0, role: 1, source: [2, 3], notes: 6 } },
  { file: "sheet2.xml", group: "Friends & Extended Circle", c: { name: 0, role: 1, source: [2], notes: 5 } },
];

const mapped: Mapped[] = [];
for (const sheet of SHEETS) {
  for (const r of parseSheet(sheet.file).slice(1)) {
    const name = clean(r[sheet.c.name]);
    if (!name) continue;
    const { firstName, lastName } = splitName(name);
    const source = sheet.c.source.map((i) => clean(r[i])).filter(Boolean).join(" / ");
    const notes = [clean(r[sheet.c.notes]), source ? `Source: ${source}` : null, `(${sheet.group})`]
      .filter(Boolean)
      .join(" · ");
    mapped.push({ firstName, lastName, title: clean(r[sheet.c.role]), notes: notes || null });
  }
}

const start = startMonday(new Date());

const prisma = new PrismaClient({ adapter: new PrismaPg(pgConfig()) });
const zain = await prisma.user.findUniqueOrThrow({ where: { email: ZAIN_EMAIL } });

// Dedupe against Zain's existing warm leads (first+last name).
const existing = await prisma.contact.findMany({
  where: { ownerId: zain.id, stage: ContactStage.WARM_LEAD },
  select: { firstName: true, lastName: true },
});
const seen = new Set(existing.map((c) => `${c.firstName}|${c.lastName ?? ""}`.toLowerCase()));

const toCreate = mapped.filter((m) => !seen.has(`${m.firstName}|${m.lastName ?? ""}`.toLowerCase()));
const skipped = mapped.length - toCreate.length;

if (DRY_RUN) {
  console.log(`DRY RUN — owner: ${zain.name} <${zain.email}>`);
  console.log(`parsed ${mapped.length}, would create ${toCreate.length}, skip ${skipped} (already warm)`);
  console.log(`start Monday: ${start.toDateString()} | ${PER_WEEK}/week (weekdays)\n`);
  const byWeek = new Map<string, number>();
  toCreate.forEach((m, i) => {
    const d = spreadDate(start, i);
    const wk = addDays(d, -(d.getDay() === 0 ? 6 : d.getDay() - 1)).toDateString();
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
  });
  console.log("per-week counts:");
  [...byWeek].forEach(([wk, n]) => console.log(`  week of ${wk}: ${n}`));
  console.log("\nsamples:");
  toCreate.slice(0, 6).forEach((m, i) =>
    console.log(`  ${spreadDate(start, i).toDateString()}  ${m.firstName} ${m.lastName ?? ""} | ${m.title ?? "-"} | ${m.notes}`),
  );
  await prisma.$disconnect();
  process.exit(0);
}

let n = 0;
for (let i = 0; i < toCreate.length; i++) {
  const m = toCreate[i];
  const dueAt = spreadDate(start, i);
  await prisma.contact.create({
    data: {
      firstName: m.firstName,
      lastName: m.lastName,
      title: m.title,
      notes: m.notes,
      type: ContactType.OTHER,
      stage: ContactStage.WARM_LEAD,
      ownerId: zain.id,
      nextFollowUpAt: dueAt,
      reminders: { create: { userId: zain.id, dueAt, status: ReminderStatus.PENDING } },
    },
  });
  n++;
}
console.log(`Created ${n} warm leads for ${zain.name} (skipped ${skipped} already present).`);
await prisma.$disconnect();
