import { PrismaClient } from '@prisma/client';
import { SubmissionsService } from '../src/submissions/submissions.service';

const prisma = new PrismaClient();
const service = new SubmissionsService(prisma);

async function main() {
  console.log('--- TESTING DOWNLOAD ENDPOINT LOGIC ---');

  const milestoneId = '2c630922-a4d2-4580-8ceb-197031d3d516';
  
  // Find the Tech Team user
  const user = await prisma.user.findFirst({
    where: { email: 'testflowtech@tempmail.id.vn' },
  });

  if (!user) {
    console.log('User not found.');
    return;
  }

  console.log(`Testing as User: ${user.fullName} (${user.id})`);
  console.log(`Active Role: ${user.activeRole}, Subtype: ${user.clientSubtype}`);

  try {
    const result = await service.downloadDocument(milestoneId, {
      id: user.id,
      activeRole: user.activeRole,
      clientSubtype: user.clientSubtype,
    });
    console.log('\nResult returned successfully:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('\nAPI Logic Threw Exception:');
    console.error(`- Status/Code: ${error.status || error.statusCode}`);
    console.error(`- Message: ${error.message}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
