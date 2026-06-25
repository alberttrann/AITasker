// backend/src/payments/ipn-handler.service.ts
// CHANGED: handleMilestoneTopup now implements the Pass-Through Ledger
// Pattern explicitly — Leg 1 (inbound top-up, real TOP_UP transaction
// record) then Leg 2 (lock, delegated to LedgerService.lockMilestoneEscrowWithTx
// so the logic is shared with the new pay-from-wallet path, not duplicated).
// Also simplified the wallet lookup to use engagement.clientId directly
// (now that it exists) instead of traversing through Project.
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { EngagementState } from '@common/enums/engagement-state.enum';
import { SignOffAuthority } from '@common/enums/sign-off-auth.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VirtualAccount } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { LedgerService } from '@shared/ledger/ledger.service';

@Injectable()
export class IpnHandlerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
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

    return await this.prisma.$transaction(async (tx) => {
      switch (userVirtualAccount.entityType) {
        case VAEntityType.MILESTONE:
          return this.handleMilestoneTopup(tx, userVirtualAccount, referenceCode, transferAmount);
        case VAEntityType.SERVICE:
          return this.handleServiceTopup(tx, userVirtualAccount, referenceCode, transferAmount);
        default:
          return this.handleWalletTopup(tx, userVirtualAccount, referenceCode, transferAmount);
      }
    });
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

    // SIMPLIFIED: was traversing engagement -> project -> project.clientId.
    // engagement.clientId already carries this value directly (populated
    // at creation by bids.service.ts), avoiding an extra query and a
    // dependency on engagement.projectId always being non-null.
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

    // ── Pass-Through Ledger Pattern ─────────────────────────────────────
    // LEG 1 — Inbound: fresh external money lands in the wallet, exactly
    // like a normal top-up. This is what makes Leg 2's decrement safe —
    // availableBalance goes UP by transferAmount here, then immediately
    // back DOWN by the same amount in Leg 2, never dipping below its
    // starting value at any point, so the available_balance >= 0 CHECK
    // constraint is never at risk.
    await tx.wallet.update({
      where: { id: clientWallet.id },
      data: { availableBalance: { increment: transferAmount } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: clientWallet.id,
        amount: transferAmount,
        transactionType: TransactionType.TOP_UP,
        referenceId: referenceCode,
      },
    });

    // LEG 2 — Lock: immediately freeze it for this milestone. Shared with
    // the pay-from-wallet path via LedgerService, not duplicated here.
    await this.ledgerService.lockMilestoneEscrowWithTx(
      tx,
      milestone,
      clientWallet.id,
      expertWallet.id,
      transferAmount,
      referenceCode,
    );

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

    // Chi Nhan's own flagged gap, unchanged: "Handle idempotency get
    // blocked by no clientId tracing through -> Fix later"

    await tx.milestone.create({
      data: {
        engagementId: engagement.id,
        milestoneNumber: 1,
        signOffAuthority: SignOffAuthority.CEO,
        paymentAmountVnd: Number(transferAmount),
        state: MilestoneState.FUNDED,
        fundedAt: new Date(),
      },
    });

    await tx.engagement.update({
      where: { id: engagement.id },
      data: { state: EngagementState.ACTIVE },
    });

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

    return { success: true };
  }
}