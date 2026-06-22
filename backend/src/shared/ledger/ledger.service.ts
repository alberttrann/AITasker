import { EscrowStatus } from '@common/enums/escrow-status.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async releaseMilestone(milestoneId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const mileStone = await tx.milestone.findUnique({
        where: {
          id: milestoneId,
        },
      });

      if (!(mileStone.state === MilestoneState.SUBMITTED)) {
        throw new ConflictException('This milestone is not submitted!');
      }

      const escrowAccount = await tx.escrowAccount.findFirst({
        where: {
          milestoneId: mileStone.id,
        },
      });

      if (!(escrowAccount.status === EscrowStatus.HELD)) {
        throw new ConflictException('This escrow account status is not HELD!');
      }

      const platformSettings = await tx.platformSettings.findFirst({
        select: {
          id: true,
          platformWalletId: true,
          platformFeePct: true,
        },
      });

      const platformFeePct = platformSettings.platformFeePct;

      /*
        Process money from the amount of the escrow account assign with the milestone
        1. 5% to the platform fee
        2. Expert receive money extract from the rest

        After finish compute:
        1. Transfer money into the platform settings wallet
        2. Reduce the locked amount of the client wallet
        3. Update the money of expert client

        Note that below every step:
        -> Record every perfomed above to the transactions record
      */
      const escrowTotalAmount = Number(escrowAccount.amount);
      const platformAmount = Math.round(escrowTotalAmount * platformFeePct);
      const expertAmount = escrowTotalAmount - platformAmount;

      // Finding platform wallet and update wallet ammount
      await tx.wallet.update({
        where: {
          id: platformSettings.platformWalletId,
        },
        data: {
          availableBalance: {
            increment: platformAmount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: platformSettings.platformWalletId,
          amount: BigInt(platformAmount),
          transactionType: TransactionType.PLATFORM_FEE,
          referenceId: mileStone.id,
        },
      });

      // Update client wallet locked ammount
      await tx.wallet.update({
        where: {
          id: escrowAccount.clientWalletId,
        },
        data: {
          lockedBalance: {
            decrement: escrowTotalAmount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: escrowAccount.clientWalletId,
          amount: BigInt(escrowTotalAmount),
          transactionType: TransactionType.ESCROW_RELEASE,
          referenceId: mileStone.id,
        },
      });

      // Update expert wallet ammount
      await tx.wallet.update({
        where: {
          id: escrowAccount.expertWalletId,
        },
        data: {
          availableBalance: {
            increment: expertAmount,
          },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: escrowAccount.expertWalletId,
          amount: BigInt(expertAmount),
          transactionType: TransactionType.ESCROW_RELEASE,
          referenceId: mileStone.id,
        },
      });

      // Update escrow status and milestone status
      await tx.escrowAccount.update({
        where: {
          id: escrowAccount.id,
        },
        data: {
          status: EscrowStatus.RELEASED,
          releasedAt: new Date(),
        },
      });

      await tx.milestone.update({
        where: {
          id: mileStone.id,
        },
        data: {
          state: MilestoneState.APPROVED,
          approvedAt: new Date(),
        },
      });

      // Create withdrawal request
      // Implement later
    });
  }
}
