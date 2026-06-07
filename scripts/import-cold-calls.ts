/**
 * Import austin-permits `cold_calls_jun7_12` → CRM contacts, split 50/50 into two
 * permanent lists ("Zain's Leads" / "Alejandro's Leads").
 *
 *   DRY_RUN=1 npx tsx scripts/import-cold-calls.ts   # preview, no writes
 *           npx tsx scripts/import-cold-calls.ts      # live load
 *
 * Reads the DuckDB table via the `duckdb` CLI, maps each row → Contact, dedupes by phone
 * against what's already in the DB (so weekly re-runs only add new leads), then shuffles
 * (seeded → reproducible) and splits evenly across the two assigned lists.
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
const LIST_ZAIN = "Zain's Leads";
const LIST_ALE = "Alejandro's Leads";
const LIST_DESC = "Cold-call leads sourced from Austin building permits.";

// Fixed seed → the same shuffle/split every run (dry-run preview matches the live load).
const SHUFFLE_SEED = 20260607;

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

/** Digits only — used to dedupe regardless of formatting. */
function normalizePhone(raw: string | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** "5128372917" -> "(512) 837-2917"; pass through anything that isn't 10/11 digits. */
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

/** Small seeded PRNG so the shuffle is random-looking but reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Prepared {
  firstName: string;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  phoneDigits: string;
  notes: string;
  type: ContactType;
  permits: number;
  austin: boolean;
}

const summarize = (arr: Prepared[]) => ({
  count: arr.length,
  highValue: arr.filter((c) => c.permits >= 10).length, // 10+ permits
  austin: arr.filter((c) => c.austin).length,
});

async function findOrCreateList(
  prisma: PrismaClient,
  name: string,
  ownerId: string,
  assigneeId: string,
) {
  const existing = await prisma.segment.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.segment.create({ data: { name, ownerId, assigneeId, description: LIST_DESC } });
}

async function main() {
  const rows = readRows();
  console.log(`Read ${rows.length} rows from ${TABLE}.`);

  const prepared: Prepared[] = rows.map((r) => {
    const { firstName, lastName } = splitName(r.contact_name);
    return {
      firstName,
      lastName,
      company: r.business?.trim() || null,
      phone: formatPhone(r.best_phone),
      phoneDigits: normalizePhone(r.best_phone),
      notes: buildNotes(r),
      type: mapType(r.trade),
      permits: r.permits ?? 0,
      austin: /austin/i.test(r.city ?? ""),
    };
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg(pgConfig()) });
  try {
    // Dedupe by phone: skip anyone already in the DB, and any dup within this batch.
    const existing = await prisma.contact.findMany({ select: { phone: true } });
    const existingDigits = new Set(
      existing.map((c) => normalizePhone(c.phone)).filter(Boolean),
    );
    const seen = new Set<string>();
    const toImport: Prepared[] = [];
    let skipped = 0;
    for (const c of prepared) {
      const d = c.phoneDigits;
      if (d && (existingDigits.has(d) || seen.has(d))) {
        skipped++;
        continue;
      }
      if (d) seen.add(d);
      toImport.push(c);
    }

    // Seeded shuffle, then even 50/50 split (Zain gets the odd one out).
    const shuffled = shuffle(toImport, mulberry32(SHUFFLE_SEED));
    const half = Math.ceil(shuffled.length / 2);
    const zainRows = shuffled.slice(0, half);
    const aleRows = shuffled.slice(half);

    console.log(`\nAfter dedupe: ${toImport.length} new (skipped ${skipped} already-imported).`);
    console.log(`Split (count · high-value 10+ · Austin-area):`);
    console.log(`  Zain      → ${JSON.stringify(summarize(zainRows))}`);
    console.log(`  Alejandro → ${JSON.stringify(summarize(aleRows))}`);

    if (DRY_RUN) {
      const s = zainRows[0];
      if (s) {
        console.log(`\n=== SAMPLE transformed contact (Zain #1) ===`);
        console.log(`name:    ${s.firstName} ${s.lastName ?? ""}`);
        console.log(`company: ${s.company}`);
        console.log(`phone:   ${s.phone}`);
        console.log(`type:    ${s.type}`);
        console.log(`notes:\n${s.notes}`);
      }
      console.log(`\n(DRY_RUN — no database writes. Run without DRY_RUN=1 to load.)`);
      return;
    }

    if (toImport.length === 0) {
      console.log(`\nNothing new to import. Done.`);
      return;
    }

    const zain = await prisma.user.findUniqueOrThrow({ where: { email: ZAIN_EMAIL } });
    const ale = await prisma.user.findUniqueOrThrow({ where: { email: ALE_EMAIL } });

    const segZain = await findOrCreateList(prisma, LIST_ZAIN, zain.id, zain.id);
    const segAle = await findOrCreateList(prisma, LIST_ALE, zain.id, ale.id);

    let n = 0;
    for (const [segId, ownerId, list] of [
      [segZain.id, zain.id, zainRows],
      [segAle.id, ale.id, aleRows],
    ] as const) {
      for (const c of list) {
        await prisma.contact.create({
          data: {
            firstName: c.firstName,
            lastName: c.lastName,
            company: c.company,
            phone: c.phone,
            notes: c.notes,
            type: c.type,
            ownerId,
            segments: { create: { segmentId: segId } },
          },
        });
        n++;
      }
    }
    console.log(`\n✓ Loaded ${n} contacts (${zainRows.length} → ${LIST_ZAIN}, ${aleRows.length} → ${LIST_ALE}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
