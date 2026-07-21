const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing domains...');
    await prisma.domainDefinition.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, description: true, sortOrder: true } });
    console.log('Domains OK');

    console.log('Testing seams...');
    await prisma.seamDefinition.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, description: true, sortOrder: true, domainCode1: true, domainCode2: true } });
    console.log('Seams OK');

    console.log('Testing archetypes...');
    await prisma.archetypeDefinition.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, description: true, sortOrder: true } });
    console.log('Archetypes OK');

    console.log('Testing voidCodes...');
    await prisma.voidCodeDefinition.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, description: true, severity: true } });
    console.log('VoidCodes OK');

    console.log('Testing subscriptionPackages...');
    await prisma.subscriptionPackage.findMany({ where: { isActive: true }, select: { id: true, role: true, name: true, priceVnd: true, durationMonths: true } });
    console.log('SubscriptionPackages OK');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
