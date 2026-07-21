import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = "ceofresh@gmail.com";
  const expertEmail = "mockexpertfresh@gmail.com";

  console.log("🧹 Cleaning up any existing test data for ceofresh@gmail.com...");

  // 1. Find existing users to clean up associated records
  const existingUser = await prisma.user.findUnique({ where: { email } });
  const existingExpert = await prisma.user.findUnique({ where: { email: expertEmail } });

  if (existingUser) {
    // Delete projects, engagements, milestones, VAs
    const projects = await prisma.project.findMany({ where: { clientId: existingUser.id } });
    const projectIds = projects.map(p => p.id);

    const engagements = await prisma.engagement.findMany({
      where: {
        OR: [
          { clientId: existingUser.id },
          { projectId: { in: projectIds } }
        ]
      }
    });
    const engagementIds = engagements.map(e => e.id);

    const milestones = await prisma.milestone.findMany({ where: { engagementId: { in: engagementIds } } });
    const milestoneIds = milestones.map(m => m.id);

    // Delete Virtual accounts
    await prisma.virtualAccount.deleteMany({
      where: {
        OR: [
          { entityId: { in: milestoneIds }, entityType: "MILESTONE" },
          { entityId: existingUser.id, entityType: "WALLET_TOPUP" }
        ]
      }
    });

    // Delete milestones and sub-records
    await prisma.acceptanceCriterion.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
    await prisma.milestoneDodItem.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
    await prisma.milestoneSubmission.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
    await prisma.paygatedDocument.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
    await prisma.escrowAccount.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
    await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });

    // Delete engagements
    await prisma.capabilityBid.deleteMany({ where: { engagementId: { in: engagementIds } } });
    await prisma.engagement.deleteMany({ where: { id: { in: engagementIds } } });

    // Delete projects
    await prisma.projectShortlistCache.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });

    // Delete client profiles & wallets
    await prisma.clientProfile.deleteMany({ where: { userId: existingUser.id } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: existingUser.id } } });
    await prisma.wallet.deleteMany({ where: { userId: existingUser.id } });

    // Delete User
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  if (existingExpert) {
    await prisma.expertProfile.deleteMany({ where: { userId: existingExpert.id } });
    await prisma.walletTransaction.deleteMany({ where: { wallet: { userId: existingExpert.id } } });
    await prisma.wallet.deleteMany({ where: { userId: existingExpert.id } });
    await prisma.user.delete({ where: { id: existingExpert.id } });
  }

  console.log("🌱 Creating a fresh CEO user, ClientProfile, and Wallet...");
  const passwordHash = await bcrypt.hash("Str0ng!SimPass123", 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: "Fresh CEO User",
      roles: ["CLIENT"],
      activeRole: "CLIENT",
      clientSubtype: "CEO",
      wallet: {
        create: {
          availableBalance: 0,
          lockedBalance: 0,
        }
      },
      clientProfile: {
        create: {
          companyName: "Fresh Tech CEO Corp",
          industry: "Digital Health",
          ceoName: "Fresh CEO User"
        }
      }
    }
  });

  console.log("🌱 Creating a fresh Expert user, profile, and Wallet...");
  const expert = await prisma.user.create({
    data: {
      email: expertEmail,
      passwordHash,
      fullName: "Fresh Expert User",
      roles: ["EXPERT"],
      activeRole: "EXPERT",
      wallet: {
        create: {
          availableBalance: 0,
          lockedBalance: 0,
        }
      },
      expertProfile: {
        create: {
          bio: "Expert Fullstack developer specializing in telehealth apps.",
          engagementModel: "FULL_TIME",
        }
      }
    }
  });

  console.log("🌱 Creating Project...");
  const project = await prisma.project.create({
    data: {
      clientId: user.id,
      projectName: "Fresh Telehealth Escrow Project",
      state: "PUBLISHED"
    }
  });

  console.log("🌱 Creating Connected Engagement (Both NDAs signed)...");
  const engagement = await prisma.engagement.create({
    data: {
      projectId: project.id,
      clientId: user.id,
      expertId: expert.id,
      type: "PROJECT_BASED",
      state: "CONNECTED",
      clientNdaAcceptedAt: new Date(),
      expertNdaAcceptedAt: new Date(),
      connectedAt: new Date()
    }
  });

  console.log("🌱 Creating Milestone (2,000 VND, DEFINED state)...");
  const milestone = await prisma.milestone.create({
    data: {
      engagementId: engagement.id,
      milestoneNumber: 1,
      deliverableStatement: "Build working Prototype",
      signOffAuthority: "CEO",
      paymentAmountVnd: 2000,
      state: "DEFINED",
      acceptanceCriteria: {
        create: [
          {
            criterionText: "Prototype is fully operational",
            isRequired: true,
            verifiedByRole: "CEO"
          }
        ]
      }
    }
  });

  console.log("\n=== SEED COMPLETE ===");
  console.log(`CEO Email: ${email}`);
  console.log(`CEO Password: Str0ng!SimPass123`);
  console.log(`\nMilestone ID: ${milestone.id}`);
  console.log(`Engagement ID: ${engagement.id}`);
  console.log(`\n=== TESTING INSTRUCTIONS ===`);
  console.log(`1. Log in to the application as client:`);
  console.log(`   - Email: ${email}`);
  console.log(`   - Password: Str0ng!SimPass123`);
  console.log(`2. Navigate to this URL to view the Milestone Funding page:`);
  console.log(`   http://localhost:5173/ceo/engagements/${engagement.id}/milestones/${milestone.id}/fund`);
  console.log(`3. To view the Milestones List, go here:`);
  console.log(`   http://localhost:5173/ceo/engagements/${engagement.id}/milestones`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
