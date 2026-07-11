import { PrismaClient } from '@prisma/client';

// Fixed IDs used across all test suites — keep in sync with jest.e2e.config.js
export const SEED_IDS = {
  platformAdminUserId: '00000000-0000-0000-0000-000000000099',
  platformWalletId: '00000000-0000-0000-0000-000000000005',
  platformSettingsId: '00000000-0000-0000-0000-000000000004',
};

export class DbSeeder {
  // Wipe all test data in FK-safe order (children before parents)
  static async cleanDatabase(prisma: PrismaClient): Promise<void> {
    // 1. Leaf nodes (Audit, Messaging, Reviews, Chats, Invitations)
    await prisma.platformDecision.deleteMany({});
    await prisma.messageRead.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.milestoneChatSession.deleteMany({});
    await prisma.invitation.deleteMany({});

    // 2. Disputes (References criteria, escrows, milestones, engagements)
    await prisma.dispute.deleteMany({});

    // 3. Milestone children & Escrows & Withdrawals
    await prisma.withdrawalRequest.deleteMany({});
    await prisma.escrowAccount.deleteMany({});
    await prisma.paygatedDocument.deleteMany({});
    await prisma.milestoneDodItem.deleteMany({});
    await prisma.acceptanceCriterion.deleteMany({});
    await prisma.milestoneSubmission.deleteMany({});

    // 4. Core Workflow (Milestones, Bids, Engagements)
    await prisma.milestone.deleteMany({});
    await prisma.capabilityBid.deleteMany({});
    await prisma.engagement.deleteMany({});

    // 5. Projects & Services & Sessions
    await prisma.service.deleteMany({});
    await prisma.techTeamProfile.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.elicitationSession.deleteMany({});

    // 6. Profiles & Wallets & Users
    await prisma.portfolioSubmission.deleteMany({});
    await prisma.expertSeamClaim.deleteMany({});
    await prisma.expertDomainDepth.deleteMany({});
    await prisma.expertProfile.deleteMany({});
    await prisma.clientProfile.deleteMany({});

    await prisma.walletTransaction.deleteMany({});
    await prisma.virtualAccount.deleteMany({});
    await prisma.platformSettings.deleteMany({});
    await prisma.subscriptionPurchaseLog.deleteMany({}); 
    await prisma.subscriptionPackage.deleteMany({});     
    await prisma.wallet.deleteMany({});

    await prisma.subscriptionPurchaseLog.deleteMany({});
    await prisma.subscriptionPackage.deleteMany({});

    await prisma.user.deleteMany({});
  }

  // Seed mandatory system records that every test suite depends on
  // FIX [BLOCK-10]: wallet must exist before platformSettings references it.
  // FIX [BLOCK-9]:  Prisma requires camelCase field names — not snake_case.
  static async seedDefaults(prisma: PrismaClient): Promise<void> {
    // 1. System admin user (owns the platform wallet)
    await prisma.user.upsert({
      where: { id: SEED_IDS.platformAdminUserId },
      update: {},
      create: {
        id: SEED_IDS.platformAdminUserId,
        email: 'platform-admin@aitasker.internal',
        passwordHash: 'not-a-real-hash',
        fullName: 'Platform Admin',
        activeRole: 'ADMIN',
        isActive: true,
      },
    });

    // 2. Platform wallet (owned by admin user — FK satisfied)
    await prisma.wallet.upsert({
      where: { id: SEED_IDS.platformWalletId },
      update: {},
      create: {
        id: SEED_IDS.platformWalletId,
        userId: SEED_IDS.platformAdminUserId,
        availableBalance: 0n,
        lockedBalance: 0n,
      },
    });

    // 3. Platform settings (references the wallet above)
    await prisma.platformSettings.upsert({
      where: { id: SEED_IDS.platformSettingsId },
      update: {},
      create: {
        id: SEED_IDS.platformSettingsId,
        platformFeePct: 0.05, // camelCase — was snake_case
        platformWalletId: SEED_IDS.platformWalletId, // camelCase — was snake_case
      },
    });
  }

  // Create a minimal user + wallet for a test scenario
  static async seedUser(
    prisma: PrismaClient,
    opts: {
      id: string;
      email: string;
      activeRole: string;
      clientSubtype?: string;
    },
  ) {
    const user = await prisma.user.create({
      data: {
        id: opts.id,
        email: opts.email,
        passwordHash: 'not-a-real-hash',
        fullName: `Test ${opts.activeRole} ${opts.id.slice(0, 8)}`,
        activeRole: opts.activeRole,
        clientSubtype: opts.clientSubtype ?? null,
        isActive: true,
      },
    });

    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        availableBalance: 0n,
        lockedBalance: 0n,
      },
    });

    return { user, wallet };
  }
}
