// backend/src/shared/ledger/ledger.service.ts
// ADDED: refundEscrowWithTx() and splitEscrowWithTx() — the two dispute-
// resolution outcomes beyond expert_wins (which just flows through the
// normal releaseMilestoneWithTx path unchanged). Both require the escrow
// to be FROZEN (set when a dispute is filed — see DisputesService below) —
// this is a deliberate guard ensuring these can ONLY run as part of an
// actual dispute resolution, never accidentally from elsewhere.
//
// Full file — replaces ledger_service_pass_through.ts.
import { EscrowStatus } from '@common/enums/escrow-status.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { EngagementState } from '@common/enums/engagement-state.enum';
import { PayGatedDocumentReleaseState } from '@common/enums/paygated-document-release-state.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

    // Create withdrawal request
    // Implement later
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

  // ADDED — dispute outcome: client_wins. Full refund, milestone moves to
  // the terminal DISPUTE_RESOLVED state (not a backward loop — see the
  // design writeup for why looping back to AWAITING_PAYMENT doesn't make
  // sense once the original escrow is gone).
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
        data: { state: MilestoneState.DISPUTE_RESOLVED },
      });
    }
  }

  // ADDED — dispute outcome: split (Admin-only — AI's binary finding can
  // never produce this on its own). Platform fee applies ONLY to the
  // expert's disbursed share, at the same rate as a full release — the
  // client's refunded share is fee-free, consistent with the fee
  // representing the platform's cut of value actually delivered, never
  // charged on money returning to the client.
  async splitEscrowWithTx(
    tx: PrismaTx,
    escrowAccountId: string,
    expertSharePercent: number,
  ): Promise<void> {
    if (expertSharePercent < 0 || expertSharePercent > 100) {
      throw new BadRequestException('expertSharePercent must be between 0 and 100.');
    }

    const escrowAccount = await tx.escrowAccount.findUnique({ where: { id: escrowAccountId } });
    if (!escrowAccount) {
      throw new NotFoundException('Escrow account not found.');
    }
    if (escrowAccount.status !== EscrowStatus.FROZEN) {
      throw new ConflictException(
        `Escrow is in status ${escrowAccount.status}; split requires FROZEN (set when a dispute is filed).`,
      );
    }

    const platformSettings = await tx.platformSettings.findFirst({
      select: { platformWalletId: true, platformFeePct: true },
    });
    if (!platformSettings) {
      throw new NotFoundException('Platform settings not configured.');
    }

    const escrowTotal = Number(escrowAccount.amount);
    const expertGrossShare = Math.round(escrowTotal * (expertSharePercent / 100));
    const platformFee = Math.round(expertGrossShare * platformSettings.platformFeePct);
    const expertNetShare = expertGrossShare - platformFee;
    const clientRefundShare = escrowTotal - expertGrossShare;

    await tx.wallet.update({
      where: { id: platformSettings.platformWalletId },
      data: { availableBalance: { increment: platformFee } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: platformSettings.platformWalletId,
        amount: BigInt(platformFee),
        transactionType: TransactionType.PLATFORM_FEE,
        referenceId: escrowAccount.milestoneId ?? escrowAccount.id,
      },
    });

    await tx.wallet.update({
      where: { id: escrowAccount.expertWalletId },
      data: { availableBalance: { increment: expertNetShare } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.expertWalletId,
        amount: BigInt(expertNetShare),
        transactionType: TransactionType.ESCROW_SPLIT,
        referenceId: escrowAccount.milestoneId ?? escrowAccount.id,
      },
    });

    // Client: the FULL escrow total leaves lockedBalance (the whole amount
    // was held, regardless of how it gets divided up); availableBalance
    // gets back only their refunded portion.
    await tx.wallet.update({
      where: { id: escrowAccount.clientWalletId },
      data: {
        lockedBalance: { decrement: escrowTotal },
        availableBalance: { increment: clientRefundShare },
      },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: escrowAccount.clientWalletId,
        amount: BigInt(clientRefundShare),
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
        data: { state: MilestoneState.DISPUTE_RESOLVED },
      });
    }
  }
}