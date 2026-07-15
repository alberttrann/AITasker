import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const milestone = await prisma.milestone.findUnique({
    where: { id: "dfe0395c-8d8d-4dc5-8e12-989bb42c258a" }
  });
  console.log("=== MILESTONE STATE ===");
  if (milestone) {
    console.log("ID:", milestone.id);
    console.log("State:", milestone.state);
    console.log("vaNumber:", milestone.vaNumber);
    console.log("paymentAmountVnd:", milestone.paymentAmountVnd?.toString());
    console.log("fundedAt:", milestone.fundedAt);
  } else {
    console.log("Milestone not found.");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
