import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.elicitationSession.findMany({
    select: {
      id: true,
      state: true,
      currentStage: true,
      userId: true,
      updatedAt: true
    }
  });
  console.log(JSON.stringify(sessions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
