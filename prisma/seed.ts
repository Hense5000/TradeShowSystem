import { PrismaClient } from "@prisma/client";

// Example feature catalog. Adjust names and link Stripe prices later.
const FEATURES = [
  { key: "lead-capture", name: "Lead capture", description: "Scan badges and collect leads at the booth." },
  { key: "event-calendar", name: "Event calendar", description: "Plan the trade shows your company attends." },
  { key: "reporting", name: "Reporting", description: "Reports on leads and results per trade show." },
];

const db = new PrismaClient();

async function main() {
  for (const feature of FEATURES) {
    await db.feature.upsert({ where: { key: feature.key }, create: feature, update: {} });
  }
  console.log(`Seeded ${FEATURES.length} features.`);
}

main().finally(() => db.$disconnect());
