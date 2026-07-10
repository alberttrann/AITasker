import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const targetClientIds = [
    "298e83da-0c5c-4636-b4b2-7ef8f03cec88",
    "a5876724-d74e-4e50-a832-ad95d8c4cf9d"
  ];

  const clients = await prisma.user.findMany({
    where: {
      id: { in: targetClientIds }
    },
    select: {
      id: true,
      email: true,
      activeRole: true,
      clientSubtype: true,
    }
  });

  console.log("=== TARGET CLIENTS ===");
  console.log(JSON.stringify(clients, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
