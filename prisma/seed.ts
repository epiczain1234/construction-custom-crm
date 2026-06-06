import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { pgConfig } from "../src/lib/pg-config";

const adapter = new PrismaPg(pgConfig());
const prisma = new PrismaClient({ adapter });

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  console.log("Seeding users…");
  const zain = await prisma.user.upsert({
    where: { email: "mukatizain@gmail.com" },
    update: { name: "Zain" },
    create: { name: "Zain", email: "mukatizain@gmail.com" },
  });
  const alejandro = await prisma.user.upsert({
    where: { email: "alejandro@example.com" },
    update: { name: "Alejandro" },
    create: { name: "Alejandro", email: "alejandro@example.com" },
  });

  console.log("Seeding segments…");
  const sharedProspects = await prisma.segment.create({
    data: {
      name: "Cold Prospects",
      description: "Shared cold-calling list — unassigned, anyone can work it.",
      ownerId: zain.id,
      assigneeId: null,
    },
  });
  const zainGCs = await prisma.segment.create({
    data: {
      name: "Zain — GCs",
      description: "General contractors Zain is working.",
      ownerId: zain.id,
      assigneeId: zain.id,
    },
  });
  await prisma.segment.create({
    data: {
      name: "Alejandro — Suppliers",
      description: "Suppliers for Alejandro to call.",
      ownerId: zain.id,
      assigneeId: alejandro.id,
    },
  });

  console.log("Seeding sample contacts…");
  const now = Date.now();
  const sample = [
    {
      firstName: "Marco",
      lastName: "Reyes",
      company: "Reyes Framing LLC",
      title: "Owner",
      phone: "+1 555-0101",
      type: "SUBCONTRACTOR" as const,
      cadenceDays: 7,
      nextFollowUpAt: new Date(now - DAY), // overdue → shows on dashboard
      segments: [sharedProspects.id],
    },
    {
      firstName: "Dana",
      lastName: "Whitfield",
      company: "Whitfield Builders",
      title: "Project Manager",
      phone: "+1 555-0102",
      type: "GENERAL_CONTRACTOR" as const,
      cadenceDays: 14,
      nextFollowUpAt: new Date(now), // due today
      segments: [sharedProspects.id, zainGCs.id],
    },
    {
      firstName: "Priya",
      lastName: "Anand",
      company: "Anand Architects",
      title: "Principal",
      phone: "+1 555-0103",
      type: "ARCHITECT" as const,
      cadenceDays: 30,
      nextFollowUpAt: new Date(now + 5 * DAY), // future
      segments: [sharedProspects.id],
    },
    {
      firstName: "Tom",
      company: "Brick & Beam Supply",
      phone: "+1 555-0104",
      type: "SUPPLIER" as const,
      segments: [sharedProspects.id],
    },
  ];

  for (const c of sample) {
    const { segments, ...data } = c;
    await prisma.contact.create({
      data: {
        ...data,
        ownerId: zain.id,
        segments: { create: segments.map((segmentId) => ({ segmentId })) },
      },
    });
  }

  console.log("Done. Users:", zain.name, "+", alejandro.name);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
