/**
 * One-time import: austin-permits `cold_calls_jun7_12` → CRM contacts + two assigned lists.
 *
 *   DRY_RUN=1 npx tsx scripts/import-cold-calls.ts   # preview, no writes
 *           npx tsx scripts/import-cold-calls.ts      # live load
 *
 * Reads the DuckDB table via the `duckdb` CLI, transforms each row into a Contact,
 * splits the rows confidence-balanced across Zain + Alejandro, and creates the two
 * weekly call lists. Re-running bails if the lists already exist (no duplicates).
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConfig } from "../src/lib/pg-config";
import { ContactType } from "../src/generated/prisma/enums";

const DUCKDB = "/Users/zain/Desktop/austin-permits/leads.duckdb";
const TABLE = "cold_calls_jun7_12";
const DRY_RUN = process.env.DRY_RUN === "1";

const ZAIN_EMAIL = "mukatizain@gmail.com";
const ALE_EMAIL = "alejandro@example.com";
const LIST_ZAIN = "Cold Calls — Jun 6–12 (Zain)";
const LIST_ALE = "Cold Calls — Jun 6–12 (Alejandro)";

interface Row {
  business: string | null;
  contact_name: string | null;
  best_phone: string | null;
  confidence: string | null;
  city: string | null;
  permits: number | null;
  notes: string | null;
  trade: string | null;
  ptype: string | null;
  wclass: string | null;
  addr: string | null;
  issued: string | null;
  important_facts_3x3: string | null;
  opener_tax: string | null;
  opener_bookkeeping: string | null;
  opener_advisory: string | null;
}

function readRows(): Row[] {
  const sql = `SELECT business, contact_name, best_phone, confidence, city, permits, notes,
    trade, ptype, wclass, addr, CAST(issued AS VARCHAR) AS issued, important_facts_3x3,
    opener_tax, opener_bookkeeping, opener_advisory FROM ${TABLE};`;
  const out = execFileSync("duckdb", [DUCKDB, "-json", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out) as Row[];
}

/** "5128372917" -> "(512) 837-2917"; pass through anything that isn't 10 digits. */
function formatPhone(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw.trim();
}

function splitName(full: string | null): { firstName: string; lastName: string | null } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function mapType(trade: string | null): ContactType {
  const t = (trade ?? "").toLowerCase();
  if (t.includes("general contractor")) return ContactType.GENERAL_CONTRACTOR;
  if (t.includes("contractor")) return ContactType.SUBCONTRACTOR; // electrical, etc.
  return ContactType.OTHER;
}

function buildNotes(r: Row): string {
  const facts = (r.important_facts_3x3 ?? "").replace(/\\n/g, "\n").trim();
  const meta = [
    r.trade && `Trade: ${r.trade}`,
    r.permits != null && `${r.permits} permits/6mo`,
    r.city,
    r.confidence && `confidence: ${r.confidence}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const research = (r.notes ?? "").trim();
  const openers = [
    r.opener_tax && `① Tax: ${r.opener_tax.trim()}`,
    r.opener_bookkeeping && `② Bookkeeping: ${r.opener_bookkeeping.trim()}`,
    r.opener_advisory && `③ Advisory: ${r.opener_advisory.trim()}`,
  ].filter(Boolean);

  return [
    facts,
    meta,
    research && `Research: ${research}`,
    openers.length ? "— OPENERS —\n" + openers.join("\n\n") : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const CONF_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

async function main() {
  const rows = readRows();
  console.log(`Read ${rows.length} rows from ${TABLE}.`);

  const contacts = rows.map((r) => {
    const { firstName, lastName } = splitName(r.contact_name);
    return {
      firstName,
      lastName,
      company: r.business?.trim() || null,
      phone: formatPhone(r.best_phone),
      notes: buildNotes(r),
      type: mapType(r.trade),
      _conf: (r.confidence ?? "medium").toLowerCase(),
    };
  });

  // Confidence-balanced split: order high→med→low, then alternate owners.
  const ordered = [...contacts].sort(
    (a, b) => (CONF_RANK[a._conf] ?? 1) - (CONF_RANK[b._conf] ?? 1),
  );
  const zainRows = ordered.filter((_, i) => i % 2 === 0);
  const aleRows = ordered.filter((_, i) => i % 2 === 1);

  const confCount = (arr: typeof contacts) =>
    arr.reduce<Record<string, number>>((m, c) => ((m[c._conf] = (m[c._conf] ?? 0) + 1), m), {});

  console.log(`\nSplit:`);
  console.log(`  Zain      → ${zainRows.length}  (${JSON.stringify(confCount(zainRows))})`);
  console.log(`  Alejandro → ${aleRows.length}  (${JSON.stringify(confCount(aleRows))})`);

  if (DRY_RUN) {
    console.log(`\n=== SAMPLE transformed contact (Zain #1) ===`);
    const s = zainRows[0];
    console.log(`name:    ${s.firstName} ${s.lastName ?? ""}`);
    console.log(`company: ${s.company}`);
    console.log(`phone:   ${s.phone}`);
    console.log(`type:    ${s.type}`);
    console.log(`notes:\n${s.notes}`);
    console.log(`\n(DRY_RUN — no database writes. Run without DRY_RUN=1 to load.)`);
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(pgConfig()) });
  try {
    const zain = await prisma.user.findUniqueOrThrow({ where: { email: ZAIN_EMAIL } });
    const ale = await prisma.user.findUniqueOrThrow({ where: { email: ALE_EMAIL } });

    const existing = await prisma.segment.findFirst({
      where: { name: { in: [LIST_ZAIN, LIST_ALE] } },
    });
    if (existing) {
      console.error(`\n✗ A list named "${existing.name}" already exists. Aborting to avoid duplicates.`);
      console.error(`  Delete it first if you want a clean re-import.`);
      process.exit(1);
    }

    const segZain = await prisma.segment.create({
      data: { name: LIST_ZAIN, ownerId: zain.id, assigneeId: zain.id, description: "Austin permit cold calls, week of Jun 6–12." },
    });
    const segAle = await prisma.segment.create({
      data: { name: LIST_ALE, ownerId: zain.id, assigneeId: ale.id, description: "Austin permit cold calls, week of Jun 6–12." },
    });

    let n = 0;
    for (const [segId, list] of [[segZain.id, zainRows], [segAle.id, aleRows]] as const) {
      for (const c of list) {
        await prisma.contact.create({
          data: {
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            phone: c.phone,
            notes: c.notes,
            type: c.type,
            ownerId: segId === segZain.id ? zain.id : ale.id,
            segments: { create: { segmentId: segId } },
          },
        });
        n++;
      }
    }
    console.log(`\n✓ Loaded ${n} contacts into 2 lists.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
