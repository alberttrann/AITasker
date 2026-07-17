import { MilestoneState } from '@common/enums/milestone-state.enum';
import { EngagementState } from '@common/enums/engagement-state.enum';
import { PayGatedDocumentReleaseState } from '@common/enums/paygated-document-release-state.enum';
import { SignOffAuthority } from '@common/enums/sign-off-auth.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VirtualAccount } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { LedgerService } from '@shared/ledger/ledger.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class IpnHandlerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleIpn(data: any) {
    const content = data.content;
    const transferAmount = BigInt(data.transferAmount);
    const referenceCode = data.referenceCode;

    const contentWords = content.split(' ');
    const paymentReference = contentWords[0];

    const userVirtualAccount = await this.prisma.virtualAccount.findUnique({
      where: { vaNumber: paymentReference },
    });

    if (!userVirtualAccount) {
      throw new ConflictException('This user VANumber is not valid!');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      switch (userVirtualAccount.entityType) {
        case VAEntityType.MILESTONE:
          return this.handleMilestoneTopup(tx, userVirtualAccount, referenceCode, transferAmount);
        case VAEntityType.SERVICE:
          return this.handleServiceTopup(tx, userVirtualAccount, referenceCode, transferAmount);
        default:
          return this.handleWalletTopup(tx, userVirtualAccount, referenceCode, transferAmount);
      }
    });

    /*
      IMPORTANT: ONLY EMIT WEBSOCKET AFTER TRANSACTION COMMITS SO A BROADCAST OR A FAILURE CAN NEVER ROLL BACK A WALLET TOP UP -> DO NOT PLACE ANY EVENT EMITTER/WEB SOCKET RELATED INSIDE THE TRANSACTIONS!

      EXPLANATION: ONCE THE WEB SOCKET/EVENT EMITTER FAIL, THE WHOLE PROCESS CHAIN IS DOWN!
    */

    // payment:confirmed for milestone escrow lock (MILESTONE VA type)
    // Guard: skip emit on idempotent retry ("Already processed") to avoid duplicate events
    if (userVirtualAccount.entityType === VAEntityType.MILESTONE && result && 'success' in result && (result as any).message !== 'Already processed') {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: userVirtualAccount.entityId },
        include: { engagement: { select: { clientId: true } } },
      });
      if (milestone) {
        try {
          this.eventEmitter.emit('socket.broadcast', {
            userId: milestone.engagement.clientId,
            event: 'payment:confirmed',
            payload: {
              engagement_id: milestone.engagementId,
              milestone_number: milestone.milestoneNumber,
              amount_vnd: Number(transferAmount),
            },
          });
        } catch (_err) {
          // Broadcast is best-effort; transaction is already committed.
        }
      }
    }

    if (
      userVirtualAccount.entityType !== VAEntityType.MILESTONE &&
      userVirtualAccount.entityType !== VAEntityType.SERVICE &&
      result &&
      'userId' in result
    ) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: String(result.userId) },
      });

      if (wallet) {
        try {
          this.eventEmitter.emit('socket.broadcast', {
            userId: result.userId,
            event: 'wallet:balance-updated',
            payload: {
              available_balance: Number(wallet.availableBalance),
              locked_balance: Number(wallet.lockedBalance),
              transaction_type: 'TOP_UP',
              amount: Number(transferAmount),
            },
          });

          this.eventEmitter.emit('socket.broadcast', {
            userId: result.userId,
            event: 'notification:generic',
            payload: {
              type: 'system',
              title: 'Top-up Successful',
              body: `Your wallet has been credited with ${transferAmount.toLocaleString('vi-VN')}
 VND.`,
            },
          });
        } catch (_err) {
          // Broadcast is best-effort; transaction is already committed.
        }
      }
    }

    return result;
  }

  async handleMilestoneTopup(
    tx: Prisma.TransactionClient,
    userVirtualAccount: VirtualAccount,
    referenceCode: string,
    transferAmount: bigint,
  ) {
    if (userVirtualAccount.fixedAmount !== transferAmount) {
      throw new ConflictException('The transfer amount is not align with the fixed amoun');
    }

    if (userVirtualAccount.expiresAt && userVirtualAccount.expiresAt < new Date()) {
      throw new ConflictException('VA has expired, generate a new one');
    }

    if (userVirtualAccount.status !== VAStatus.ACTIVE) {
      throw new ConflictException('This VA Account is not Active');
    }

    const milestone = await tx.milestone.findUnique({
      where: { id: userVirtualAccount.entityId },
    });

    if (!milestone) throw new ConflictException('Milestone not found');

    const engagement = await tx.engagement.findUnique({
      where: { id: milestone.engagementId },
    });

    if (!engagement) throw new ConflictException('Engagement not found');

    const clientWallet = await tx.wallet.findUnique({
      where: { userId: engagement.clientId },
    });

    const expertWallet = await tx.wallet.findUnique({
      where: { userId: engagement.expertId },
    });

    if (!clientWallet) throw new NotFoundException('Client wallet not found.');
    if (!expertWallet) throw new NotFoundException('Expert wallet not found.');

    const isExistedIdempotency = await tx.walletTransaction.findFirst({
      where: {
        walletId: clientWallet.id,
        referenceId: referenceCode,
      },
    });

    if (isExistedIdempotency) {
      return { success: true, message: 'Already processed' };
    }

    if (milestone.state !== MilestoneState.AWAITING_PAYMENT) {
      throw new ConflictException('This milestone is done for payment');
    }

    await this.ledgerService.fundAndLockEscrowWithTx(
      tx,
      milestone.id,
      clientWallet.id,
      expertWallet.id,
      transferAmount,
      referenceCode,
    );

    await tx.milestone.update({
      where: { id: milestone.id },
      data: {
        state: MilestoneState.IN_PROGRESS,
        fundedAt: new Date(),
      },
    });

    await tx.virtualAccount.update({
      where: { id: userVirtualAccount.id },
      data: { status: VAStatus.USED },
    });

    await tx.paygatedDocument.updateMany({
      where: { milestoneId: milestone.id },
      data: {
        releaseState: PayGatedDocumentReleaseState.RELEASED,
        releasedAt: new Date(),
      },
    });

    const countMilestone = await tx.milestone.count({
      where: {
        engagementId: engagement.id,
        state: { notIn: [MilestoneState.DEFINE, MilestoneState.AWAITING_PAYMENT] },
      },
    });

    if (countMilestone === 1) {
      await tx.engagement.update({
        where: { id: engagement.id },
        data: { state: EngagementState.ACTIVE },
      });
    }

    return { success: true };
  }

  async handleServiceTopup(
    tx: Prisma.TransactionClient,
    userVirtualAccount: VirtualAccount,
    referenceCode: string,
    transferAmount: bigint,
  ) {
    if (userVirtualAccount.fixedAmount !== transferAmount) {
      throw new ConflictException('The transfer amount is not align with the fixed amoun');
    }

    if (userVirtualAccount.expiresAt && userVirtualAccount.expiresAt < new Date()) {
      throw new ConflictException('VA has expired, generate a new one');
    }

    if (userVirtualAccount.status !== VAStatus.ACTIVE) {
      throw new ConflictException('This VA Account is not Active');
    }

    const engagement = await tx.engagement.findUnique({
      where: { id: userVirtualAccount.entityId },
    });

    if (!engagement) throw new ConflictException('Engagement not found');

    const clientWallet = await tx.wallet.findUnique({
      where: { userId: engagement.clientId },
    });
    const expertWallet = await tx.wallet.findUnique({
      where: { userId: engagement.expertId },
    });
    if (!clientWallet) throw new NotFoundException('Client wallet not found.');
    if (!expertWallet) throw new NotFoundException('Expert wallet not found.');

    // Idempotency check
    const isExistedIdempotency = await tx.walletTransaction.findFirst({
      where: {
        walletId: clientWallet.id,
        referenceId: referenceCode,
      },
    });
    if (isExistedIdempotency) {
      return { success: true, message: 'Already processed' };
    }

    const milestone = await tx.milestone.create({
      data: {
        engagementId: engagement.id,
        milestoneNumber: 1,
        signOffAuthority: SignOffAuthority.CEO,
        paymentAmountVnd: Number(transferAmount),
        state: MilestoneState.FUNDED,
        fundedAt: new Date(),
      },
    });

    await this.ledgerService.fundAndLockEscrowWithTx(
      tx,
      milestone.id,
      clientWallet.id,
      expertWallet.id,
      transferAmount,
      referenceCode,
    );

    await tx.engagement.update({
      where: { id: engagement.id },
      data: { state: EngagementState.ACTIVE },
    });

    try {
      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.expertId,
        event: 'notification:generic',
        payload: {
          type: 'system',
          title: 'Service Purchased!',
          body: 'A client has purchased your service and funded the escrow milestones.',
          link: `/expert/service`,
        },
      });
    } catch (_err) {
      // best-effort broadcast
    }

    await tx.virtualAccount.update({
      where: { id: userVirtualAccount.id },
      data: { status: VAStatus.USED },
    });

    return { success: true };
  }

  async handleWalletTopup(
    tx: Prisma.TransactionClient,
    userVirtualAccount: VirtualAccount,
    referenceCode: string,
    transferAmount: bigint,
  ) {
    const userWallet = await tx.wallet.findUnique({
      where: { userId: userVirtualAccount.entityId },
    });

    if (!userWallet) {
      throw new ConflictException('This user wallet is not exist!');
    }

    const isExistedIdempotency = await tx.walletTransaction.findFirst({
      where: {
        walletId: userWallet.id,
        referenceId: referenceCode,
      },
    });

    if (isExistedIdempotency) {
      return { success: true, message: 'Already processed' };
    }

    await tx.wallet.update({
      data: { availableBalance: { increment: transferAmount } },
      where: { id: userWallet.id },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: userWallet.id,
        amount: transferAmount,
        transactionType: TransactionType.TOP_UP,
        referenceId: referenceCode,
      },
    });

    return { success: true, userId: userWallet.userId };
  }
}
