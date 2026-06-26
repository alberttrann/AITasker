import { EscrowStatus } from '@common/enums/escrow-status.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { EngagementState } from '@common/enums/engagement-state.enum';
import { PayGatedDocumentReleaseState } from '@common/enums/paygated-document-release-state.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async releaseMilestone(milestoneId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.releaseMilestoneWithTx(tx, milestoneId);
    });
  }

  async releaseMilestoneWithTx(tx: PrismaTx, milestoneId: string): Promise<void> {
    const mileStone = await tx.milestone.findUnique({ where: { id: milestoneId } });

    if (!mileStone) {
      throw new NotFoundException('Milestone not found.');
    }

    if (!(mileStone.state === MilestoneState.SUBMITTED || mileStone.state === MilestoneState.APPROVED)) {
      throw new ConflictException('This milestone is not submitted or approved!');
    }

    const escrowAccount = await tx.escrowAccount.findFirst({ where: { milestoneId: mileStone.id } });

    if (!escrowAccount) {
      throw new NotFoundException('No escrow account found for this milestone.');
    }

    if (!(escrowAccount.status === EscrowStatus.HELD)) {
      throw new ConflictException('This escrow account status is not HELD!');
    }

    const platformSettings = await tx.platformSettings.findFirst({
      select: { id: true, platformWalletId: true, platformFeePct: true },
    });

    if (!platformSettings) {
      throw new NotFoundException('Platform settings not configured.');
    }

    const platformFeePct = platformSettings.platformFeePct;
    const escrowTotalAmount = Number(escrowAccount.amount);
    const platformAmount = Math.round(escrowTotalAmount * platformFeePct);
    const expertAmount = escrowTotalAmount - platformAmount;

    await tx.wallet.update({
      where: { id: platformSettings.platformWalletId },
      data: { availableBalance: { increment: platformAmount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: platformSettings.platformWalletId,
        amount: BigInt(platformAmount),
        transactionType: TransactionType.PLATFORM_FEE,
        referenceId: mileStone.id,
      },
    });

    await tx.wallet.update({
      where: { id: escrowAccount.clientWalletId },
      data: { lockedBalance: { decrement: escrowTotalAmount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.clientWalletId,
        amount: BigInt(escrowTotalAmount),
        transactionType: TransactionType.ESCROW_RELEASE,
        referenceId: mileStone.id,
      },
    });

    await tx.wallet.update({
      where: { id: escrowAccount.expertWalletId },
      data: { availableBalance: { increment: expertAmount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.expertWalletId,
        amount: BigInt(expertAmount),
        transactionType: TransactionType.ESCROW_RELEASE,
        referenceId: mileStone.id,
      },
    });

    await tx.escrowAccount.update({
      where: { id: escrowAccount.id },
      data: { status: EscrowStatus.RELEASED, releasedAt: new Date() },
    });

    await tx.milestone.update({
      where: { id: mileStone.id },
      data: { state: MilestoneState.APPROVED, approvedAt: new Date() },
    });

    const expertWallet = await tx.wallet.findUnique({
      where: { id: escrowAccount.expertWalletId },
      select: { userId: true },
    });
 
    if (expertWallet) {
      const expertUser = await tx.user.findUnique({
        where: { id: expertWallet.userId },
        select: { sepayBankAccountXid: true },
      });
 
      if (expertUser?.sepayBankAccountXid) {
        await tx.withdrawalRequest.create({
          data: {
            expertId:       expertWallet.userId,
            milestoneId:    mileStone.id,
            type:           'MILESTONE_RELEASE',
            amount:         expertAmount,
            bankAccountXid: expertUser.sepayBankAccountXid,
            status:         'PENDING',
          },
        });
      }
      // If the expert hasn't linked a bank account yet, no withdrawal
      // request is created — the money still landed correctly in their
      // availableBalance above; they can request a withdrawal manually
      // once linked, same as any other earnings.
    }
  }

  async lockMilestoneEscrowWithTx(
    tx: PrismaTx,
    milestone: { id: string; engagementId: string },
    clientWalletId: string,
    expertWalletId: string,
    amount: bigint | number,
    referenceCode: string,
  ): Promise<void> {
    const amountValue = typeof amount === 'bigint' ? Number(amount) : amount;

    await tx.wallet.update({
      where: { id: clientWalletId },
      data: {
        availableBalance: { decrement: amountValue },
        lockedBalance: { increment: amountValue },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: clientWalletId,
        amount: BigInt(amountValue),
        transactionType: TransactionType.ESCROW_LOCK,
        referenceId: referenceCode,
      },
    });

    await tx.escrowAccount.create({
      data: {
        milestoneId: milestone.id,
        amount: amountValue,
        clientWalletId,
        expertWalletId,
      },
    });

    await tx.milestone.update({
      where: { id: milestone.id },
      data: { state: MilestoneState.IN_PROGRESS, fundedAt: new Date() },
    });

    await tx.virtualAccount.updateMany({
      where: { entityId: milestone.id, entityType: VAEntityType.MILESTONE },
      data: { status: VAStatus.USED },
    });

    await tx.paygatedDocument.updateMany({
      where: { milestoneId: milestone.id },
      data: { releaseState: PayGatedDocumentReleaseState.RELEASED, releasedAt: new Date() },
    });

    const countMilestone = await tx.milestone.count({
      where: {
        engagementId: milestone.engagementId,
        state: { notIn: [MilestoneState.DEFINE, MilestoneState.AWAITING_PAYMENT] },
      },
    });

    if (countMilestone === 1) {
      await tx.engagement.update({
        where: { id: milestone.engagementId },
        data: { state: EngagementState.ACTIVE },
      });
    }
  }

  // Dispute outcome: client_wins. Full refund, milestone -> APPROVED
  async refundEscrowWithTx(tx: PrismaTx, escrowAccountId: string): Promise<void> {
    const escrowAccount = await tx.escrowAccount.findUnique({ where: { id: escrowAccountId } });
    if (!escrowAccount) {
      throw new NotFoundException('Escrow account not found.');
    }
    if (escrowAccount.status !== EscrowStatus.FROZEN) {
      throw new ConflictException(
        `Escrow is in status ${escrowAccount.status}; refund requires FROZEN (set when a dispute is filed).`,
      );
    }

    const amount = Number(escrowAccount.amount);

    await tx.wallet.update({
      where: { id: escrowAccount.clientWalletId },
      data: {
        lockedBalance: { decrement: amount },
        availableBalance: { increment: amount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.clientWalletId,
        amount: BigInt(amount),
        transactionType: TransactionType.ESCROW_REFUND,
        referenceId: escrowAccount.milestoneId ?? escrowAccount.id,
      },
    });

    await tx.escrowAccount.update({
      where: { id: escrowAccount.id },
      data: { status: EscrowStatus.REFUNDED, releasedAt: new Date() },
    });

    if (escrowAccount.milestoneId) {
      await tx.milestone.update({
        where: { id: escrowAccount.milestoneId },
        data: { state: MilestoneState.APPROVED, approvedAt: new Date() },
      });
    }
  }

  async splitEscrowWithTx(tx: PrismaTx, escrowAccountId: string): Promise<void> {
    const escrowAccount = await tx.escrowAccount.findUnique({ where: { id: escrowAccountId } });
    if (!escrowAccount) {
      throw new NotFoundException('Escrow account not found.');
    }
    if (escrowAccount.status !== EscrowStatus.FROZEN) {
      throw new ConflictException(
        `Escrow is in status ${escrowAccount.status}; split requires FROZEN (set when a dispute is filed).`,
      );
    }

    const escrowTotal = Number(escrowAccount.amount);
    const clientHalf = Math.floor(escrowTotal / 2);
    const expertHalf = escrowTotal - clientHalf;

    await tx.wallet.update({
      where: { id: escrowAccount.clientWalletId },
      data: {
        lockedBalance: { decrement: escrowTotal },
        availableBalance: { increment: clientHalf },
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.clientWalletId,
        amount: BigInt(clientHalf),
        transactionType: TransactionType.ESCROW_SPLIT,
        referenceId: escrowAccount.milestoneId ?? escrowAccount.id,
      },
    });

    await tx.wallet.update({
      where: { id: escrowAccount.expertWalletId },
      data: { availableBalance: { increment: expertHalf } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.expertWalletId,
        amount: BigInt(expertHalf),
        transactionType: TransactionType.ESCROW_SPLIT,
        referenceId: escrowAccount.milestoneId ?? escrowAccount.id,
      },
    });

    await tx.escrowAccount.update({
      where: { id: escrowAccount.id },
      data: { status: EscrowStatus.SPLIT, releasedAt: new Date() },
    });

    if (escrowAccount.milestoneId) {
      await tx.milestone.update({
        where: { id: escrowAccount.milestoneId },
        data: { state: MilestoneState.APPROVED, approvedAt: new Date() },
      });
    }
  }

  async fundAndLockEscrowWithTx(
    tx: PrismaTx,
    milestoneId: string,
    clientWalletId: string,
    expertWalletId: string,
    amount: bigint | number,
    referenceCode: string,
  ): Promise<void> {
    const amountValue = typeof amount === 'bigint' ? Number(amount) : amount;
 
    // LEG 1 — Inbound: the fresh external money lands in availableBalance
    // first, exactly like a normal top-up. This is what makes Leg 2's
    // decrement safe — balance goes up by amountValue here, then
    // immediately back down by the same amount in Leg 2, never dipping
    // below its starting value at any point.
    await tx.wallet.update({
      where: { id: clientWalletId },
      data: { availableBalance: { increment: amountValue } },
    });
 
    await tx.walletTransaction.create({
      data: {
        walletId: clientWalletId,
        amount: BigInt(amountValue),
        transactionType: TransactionType.TOP_UP,
        referenceId: referenceCode,
      },
    });
 
    // LEG 2 — Lock: immediately freeze it for this milestone.
    await tx.wallet.update({
      where: { id: clientWalletId },
      data: {
        availableBalance: { decrement: amountValue },
        lockedBalance: { increment: amountValue },
      },
    });
 
    await tx.walletTransaction.create({
      data: {
        walletId: clientWalletId,
        amount: BigInt(amountValue),
        transactionType: TransactionType.ESCROW_LOCK,
        referenceId: referenceCode,
      },
    });
 
    await tx.escrowAccount.create({
      data: {
        milestoneId,
        amount: amountValue,
        clientWalletId,
        expertWalletId,
      },
    });
  }
}