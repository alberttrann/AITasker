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

    if (
      userVirtualAccount.expiresAt &&
      userVirtualAccount.expiresAt < new Date() &&
      userVirtualAccount.status === VAStatus.ACTIVE
    ) {
      await this.prisma.virtualAccount.update({
        where: { id: userVirtualAccount.id },
        data: { status: VAStatus.EXPIRED },
      });
      // eslint-disable-next-line no-console
      console.error(
        '[IPN] Rejected payment against an expired VA:',
        JSON.stringify({
          vaNumber: userVirtualAccount.vaNumber,
          entityType: userVirtualAccount.entityType,
          entityId: userVirtualAccount.entityId,
          fixedAmount: userVirtualAccount.fixedAmount?.toString(),
          transferAmountReceived: transferAmount.toString(),
          referenceCode,
          vaExpiresAt: userVirtualAccount.expiresAt,
          rejectedAt: new Date().toISOString(),
        }),
      );
      throw new ConflictException('VA has expired, generate a new one');
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

    if (userVirtualAccount.entityType === VAEntityType.MILESTONE && result && 'success' in result && (result as any).message !== 'Already processed') {
      const milestone = await this.prisma.milestone.findUnique({
        where: { id: userVirtualAccount.entityId },
        include: {
          engagement: {
            select: {
              id: true,
              clientId: true,
              expertId: true,
              projectId: true,
            },
          },
        },
      });
      if (milestone) {
        try {
          const engagement = milestone.engagement;
          const recipientIds = new Set<string>([
            engagement.clientId,
            engagement.expertId,
          ]);

          if (engagement.projectId) {
            const techProfiles = await this.prisma.techTeamProfile.findMany({
              where: { linkedProjectId: engagement.projectId },
              select: { userId: true },
            });
            techProfiles.forEach((tp) => recipientIds.add(tp.userId));
          }

          for (const userId of recipientIds) {
            let rolePath = 'ceo';
            if (userId === engagement.expertId) {
              rolePath = 'expert';
            } else if (userId !== engagement.clientId) {
              rolePath = 'tech-team';
            }

            this.eventEmitter.emit('socket.broadcast', {
              userId,
              event: 'payment:confirmed',
              payload: {
                engagement_id: milestone.engagementId,
                milestone_id: milestone.id,
                milestone_number: milestone.milestoneNumber,
                amount_vnd: Number(transferAmount),
              },
            });

            this.eventEmitter.emit('socket.broadcast', {
              userId,
              event: 'milestone:updated',
              payload: {
                engagement_id: milestone.engagementId,
                milestone_id: milestone.id,
                milestone_number: milestone.milestoneNumber,
                state: MilestoneState.IN_PROGRESS,
                link: `/${rolePath}/engagements/${milestone.engagementId}/milestones/${milestone.id}`,
              },
            });

            if (userId !== engagement.clientId) {
              this.eventEmitter.emit('socket.broadcast', {
                userId,
                event: 'notification:generic',
                payload: {
                  type: 'payment',
                  title: 'Milestone Funded!',
                  body: `Milestone #${milestone.milestoneNumber} (${Number(transferAmount).toLocaleString('vi-VN')} VND) has been funded into escrow by the client. Work can now begin.`,
                  link: `/${rolePath}/engagements/${milestone.engagementId}/milestones/${milestone.id}`,
                },
              });
            }
          }
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
              body: `Your wallet has been credited with ${transferAmount.toLocaleString('vi-VN')} VND.`,
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
      include: { service: true },
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

    const milestone = await tx.milestone.create({
      data: {
        engagementId: engagement.id,
        milestoneNumber: 1,
        signOffAuthority: SignOffAuthority.CEO,
        paymentAmountVnd: Number(transferAmount),
        state: MilestoneState.FUNDED,
        fundedAt: new Date(),
        deliverableStatement: `Full Delivery & Implementation for Service: "${engagement.service?.title || 'Service Listing'}"`,
      },
    });

    await tx.acceptanceCriterion.create({
      data: {
        milestoneId: milestone.id,
        criterionText: `Deliver and verify all requirements specified in the service: "${engagement.service?.title || 'Service Listing'}"`,
        isRequired: true,
        verifiedByRole: SignOffAuthority.CEO,
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

    const serviceProject = await tx.project.create({
      data: {
        clientId: engagement.clientId,
        projectName: engagement.service?.title || 'Service Purchase',
        state: 'PUBLISHED',
        selfTechnical: true,
        requiredDomainsJson: engagement.service?.domainsJson || [],
        requiredSeamsJson: engagement.service?.seamsJson || [],
      },
    });

    await tx.engagement.update({
      where: { id: engagement.id },
      data: { 
        state: EngagementState.ACTIVE,
        projectId: serviceProject.id,
      },
    });

    try {
      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.expertId,
        event: 'notification:generic',
        payload: {
          type: 'system',
          title: 'Service Purchased!',
          body: 'A client has purchased your service and funded the escrow milestones.',
          link: `/expert/engagements/${engagement.id}/milestones/${milestone.id}`,
        },
      });

      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.clientId,
        event: 'notification:generic',
        payload: {
          type: 'system',
          title: 'Payment Confirmed!',
          body: `Your payment for the service "${engagement.service?.title || 'Service Listing'}" has been confirmed.`,
          link: `/ceo/engagements/${engagement.id}/milestones`,
        },
      });

      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.clientId,
        event: 'payment:confirmed',
        payload: {
          engagement_id: engagement.id,
          milestone_number: 1,
          amount_vnd: Number(transferAmount),
        },
      });
    } catch (_err) {}

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