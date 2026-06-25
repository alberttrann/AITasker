// backend/src/milestones/milestones.service.ts
// ADDED: fundFromWallet() — the "Pay from Wallet" path. No VA/IPN involved
// at all; only the Lock Leg runs (via the SAME LedgerService method the
// VietQR path uses), since the money is already sitting in the CEO's
// availableBalance from a prior top-up or expert earnings.
import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { VAEntityType }       from '@common/enums/va-entity-type.enum';
import { MilestoneState }     from '@common/enums/milestone-state.enum';
import { LedgerService }      from '@shared/ledger/ledger.service';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createMilestone(dto: CreateMilestoneDto) {
    if (!dto.criteria || dto.criteria.length === 0) {
      throw new BadRequestException('At least one acceptance criterion is required.');
    }

    if (dto.payment_amount_vnd <= 0) {
      throw new BadRequestException('payment_amount_vnd must be greater than zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      let milestone;
      try {
        milestone = await tx.milestone.create({
          data: {
            engagementId:         dto.engagement_id,
            milestoneNumber:      dto.milestone_number,
            deliverableStatement: dto.deliverable_statement,
            signOffAuthority:     dto.sign_off_authority,
            paymentAmountVnd:     dto.payment_amount_vnd,
            state:                'DEFINED',
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          throw new ConflictException(
            `Milestone number ${dto.milestone_number} already exists for this engagement.`,
          );
        }
        throw err;
      }

      await tx.acceptanceCriterion.createMany({
        data: dto.criteria.map((c) => ({
          milestoneId:    milestone.id,
          criterionText:  c.criterion_text,
          isRequired:     c.is_required ?? true,
          verifiedByRole: dto.sign_off_authority,
        })),
      });

      return tx.milestone.findUnique({
        where:   { id: milestone.id },
        include: { acceptanceCriteria: true },
      });
    });
  }

  async initiateFunding(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new BadRequestException('Milestone cannot be found');
    }

    const vaNumber = `VA-${Math.floor(100000 + Math.random() * 900000)}`;

    await this.prisma.virtualAccount.create({
      data: {
        entityType: VAEntityType.MILESTONE,
        entityId: milestoneId,
        vaNumber: vaNumber,
        fixedAmount: milestone.paymentAmountVnd,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        state: 'AWAITING_PAYMENT',
        vaNumber: vaNumber,
        vaExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  // ADDED — "Pay from Wallet": only the Lock Leg runs, since the money is
  // already sitting in the CEO's availableBalance. No VA, no IPN at all.
  //
  // KNOWN GAP, not solved here: two simultaneous calls on the same
  // AWAITING_PAYMENT milestone could both pass the state check below
  // before either commits, double-funding it. Pre-existing risk class,
  // same as the VA/IPN path — would need SELECT...FOR UPDATE or an
  // optimistic-locking version column to close properly.
  async fundFromWallet(milestoneId: string, ceoUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const milestone = await tx.milestone.findUnique({
        where: { id: milestoneId },
      });
      if (!milestone) {
        throw new NotFoundException('Milestone not found.');
      }
      if (milestone.state !== MilestoneState.AWAITING_PAYMENT) {
        throw new ConflictException(
          `Milestone is in state ${milestone.state}; funding requires AWAITING_PAYMENT.`,
        );
      }

      const engagement = await tx.engagement.findUnique({
        where: { id: milestone.engagementId },
      });
      if (!engagement) {
        throw new ConflictException('Engagement not found.');
      }
      if (engagement.clientId !== ceoUserId) {
        throw new ForbiddenException('You are not the client on this engagement.');
      }

      const clientWallet = await tx.wallet.findUnique({ where: { userId: ceoUserId } });
      const expertWallet = await tx.wallet.findUnique({ where: { userId: engagement.expertId } });
      if (!clientWallet) throw new NotFoundException('Client wallet not found.');
      if (!expertWallet) throw new NotFoundException('Expert wallet not found.');

      // No Leg 1 exists on this path — the money must already be there.
      if (clientWallet.availableBalance < milestone.paymentAmountVnd) {
        throw new UnprocessableEntityException('INSUFFICIENT_BALANCE');
      }

      await this.ledgerService.lockMilestoneEscrowWithTx(
        tx,
        milestone,
        clientWallet.id,
        expertWallet.id,
        milestone.paymentAmountVnd,
        `WALLET-FUND-${milestoneId}`,
      );

      return { success: true };
    });
  }
}