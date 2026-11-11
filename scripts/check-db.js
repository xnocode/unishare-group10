const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Prisma keys:", Object.keys(prisma).filter(k => !k.startsWith("$") && !k.startsWith("_")));
  const journeyCount = await prisma.travelJourney.count();
  console.log("Travel journeys count:", journeyCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
