import { EngagementState } from '@common/enums/engagement-state.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { PayGatedDocumentReleaseState } from '@common/enums/paygated-document-release-state.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaClient, Prisma, VirtualAccount } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
import { PrismaService } from 'prisma/prisma.service';
@Injectable()
export class IpnHandlerService {
  constructor(private readonly prisma: PrismaService) {}
  async handleIpn(data: any) {
    // Extract fields inside body data
    const content = data.content;
    const transferAmount = BigInt(data.transferAmount);
    const referenceCode = data.referenceCode;

    const contentWords = content.split(' ');
    const paymentReference = contentWords[0];

    // Query to get the user VA Account
    const userVirtualAccount = await this.prisma.virtualAccount.findUnique({
      where: {
        vaNumber: paymentReference,
      },
    });

    if (!userVirtualAccount) {
      throw new ConflictException('This user VANumber is not valid!');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Rerouting to each of IPN Handler type
      switch (userVirtualAccount.entityType) {
        case VAEntityType.MILESTONE:
          return this.handleMilestoneTopup(tx, userVirtualAccount, referenceCode, transferAmount);
          break;
        case VAEntityType.SERVICE:
          return this.handleServiceTopup(tx, userVirtualAccount, referenceCode, transferAmount);
          break;
        default:
          return this.handleWalletTopup(tx, userVirtualAccount, referenceCode, transferAmount);
          break;
      }
    });
  }

  async handleMilestoneTopup(
    tx: Prisma.TransactionClient,
    userVirtualAccount: VirtualAccount,
    referenceCode: string,
    transferAmount: BigInt,
  ) {
    // Guards

    // Check for the transferAmoun alignment
    if (userVirtualAccount.fixedAmount !== transferAmount) {
      throw new ConflictException('The transfer amount is not align with the fixed amoun');
    }

    // Check for the expires of VA Account on Milestone branch
    if (userVirtualAccount.expiresAt && userVirtualAccount.expiresAt < new Date()) {
      throw new ConflictException('VA has expired, generate a new one');
    }

    // Check for the active of the VA Account
    if (userVirtualAccount.status !== VAStatus.ACTIVE) {
      throw new ConflictException('This VA Account is not Active');
    }

    // Get both the client wallet and expert wallet
    const milestone = await tx.milestone.findUnique({
      where: {
        id: userVirtualAccount.entityId,
      },
    });

    if (!milestone) throw new ConflictException('Milestone not found');

    const engagement = await tx.engagement.findUnique({
      where: {
        id: milestone.engagementId,
      },
    });

    if (!engagement) throw new ConflictException('Engagement not found');

    const project = await tx.project.findUnique({
      where: {
        id: engagement.projectId,
      },
    });

    if (!project) throw new ConflictException('Project not found');

    const clientWallet = await tx.wallet.findUnique({
      where: {
        userId: project.clientId,
      },
    });

    const expertWallet = await tx.wallet.findUnique({
      where: {
        userId: engagement.expertId,
      },
    });

    // Idempotency check on the client wallet
    const isExistedIdempotency = await tx.walletTransaction.findFirst({
      where: {
        walletId: clientWallet.id,
        referenceId: referenceCode,
      },
    });

    if (isExistedIdempotency) {
      return {
        success: true,
        message: 'Already processed',
      };
    }

    // Check milestone state
    if (milestone.state !== MilestoneState.AWAITING_PAYMENT) {
      throw new ConflictException('This milestone is done for payment');
    }

    // Money flow
    await tx.wallet.update({
      where: {
        id: clientWallet.id,
      },
      data: {
        availableBalance: {
          decrement: Number(transferAmount),
        },
        lockedBalance: {
          increment: Number(transferAmount),
        },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: clientWallet.id,
        amount: Number(transferAmount),
        transactionType: TransactionType.ESCROW_LOCK,
        referenceId: referenceCode,
      },
    });

    await tx.escrowAccount.create({
      data: {
        milestoneId: milestone.id,
        amount: Number(transferAmount),
        clientWalletId: clientWallet.id,
        expertWalletId: expertWallet.id,
      },
    });

    await tx.milestone.update({
      where: {
        id: milestone.id,
      },
      data: {
        state: MilestoneState.IN_PROGRESS,
        fundedAt: new Date(),
      },
    });

    await tx.virtualAccount.update({
      where: {
        id: userVirtualAccount.id,
      },
      data: {
        status: VAStatus.USED,
      },
    });

    await tx.paygatedDocument.updateMany({
      where: {
        milestoneId: milestone.id,
      },
      data: {
        releaseState: PayGatedDocumentReleaseState.RELEASED,
        releasedAt: new Date(),
      },
    });

    // Setting ACTIVE status to engagement
    const countMilestone = await tx.milestone.count({
      where: {
        engagementId: engagement.id,
        state: {
          notIn: [MilestoneState.DEFINE, MilestoneState.AWAITING_PAYMENT],
        },
      },
    });

    if (countMilestone === 1) {
      await tx.engagement.update({
        where: {
          id: engagement.id,
        },
        data: {
          state: EngagementState.ACTIVE,
        },
      });
    }

    return { success: true };
  }

  async handleServiceTopup(
    tx: Prisma.TransactionClient,
    userVirtualAccount: VirtualAccount,
    referenceCode: string,
    transferAmount: BigInt,
  ) {}

  async handleWalletTopup(
    tx: any,
    userVirtualAccount: any,
    referenceCode: any,
    transferAmount: any,
  ) {
    const userWallet = await tx.wallet.findUnique({
      where: {
        userId: userVirtualAccount.entityId,
      },
    });

    if (!userWallet) {
      throw new ConflictException('This user wallet is not exist!');
    }

    // Check Idempotency
    const isExistedIdempotency = await tx.walletTransaction.findFirst({
      where: {
        walletId: userWallet.id,
        referenceId: referenceCode,
      },
    });

    if (isExistedIdempotency) {
      return {
        success: true,
        message: 'Already processed',
      };
    }

    // Update wallet balance
    await tx.wallet.update({
      data: {
        availableBalance: {
          increment: transferAmount,
        },
      },
      where: {
        id: userWallet.id,
      },
    });

    // Create new transaction
    await tx.walletTransaction.create({
      data: {
        walletId: userWallet.id,
        amount: transferAmount,
        transactionType: TransactionType.TOP_UP,
        referenceId: referenceCode,
      },
    });

    return { success: true };
  }
}
