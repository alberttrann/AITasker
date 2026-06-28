import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '@shared/ledger/ledger.service';
import { FastapiClient } from '../elicitation/fastapi.client';
import { DisputeState } from '@common/enums/dispute-state.enum';
import { EscrowStatus } from '@common/enums/escrow-status.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { DisputeResolution } from './dto/resolve-dispute.dto';

type ActorUser = { id: string; activeRole: string; clientSubtype?: string | null };

const AUTO_RESOLVE_THRESHOLD = 0.80; 

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  // POST /disputes
  async create(filerId: string, dto: CreateDisputeDto) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id: dto.criterion_id },
      include: { milestone: true },
    });
    if (!criterion) {
      throw new NotFoundException('Acceptance criterion not found.');
    }
    if (criterion.verifiedAt !== null) {
      throw new UnprocessableEntityException('This criterion has already been verified — cannot dispute it.');
    }

    const milestone = criterion.milestone;

    if (milestone.state !== MilestoneState.SUBMITTED && milestone.state !== MilestoneState.IN_REVISION) {
      throw new UnprocessableEntityException(
        `Milestone is in state ${milestone.state}; disputing requires SUBMITTED or IN_REVISION.`,
      );
    }

    const engagement = await this.prisma.engagement.findUnique({
      where: { id: milestone.engagementId },
    });
    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    const isClient = engagement.clientId === filerId;
    const isExpert = engagement.expertId === filerId;
    if (!isClient && !isExpert) {
      throw new ForbiddenException('You are not a party to this engagement.');
    }

    const escrowAccount = await this.prisma.escrowAccount.findFirst({
      where: { milestoneId: milestone.id },
    });
    if (!escrowAccount) {
      throw new NotFoundException('No escrow account found for this milestone.');
    }
    if (escrowAccount.status !== EscrowStatus.HELD) {
      throw new ConflictException(
        `Escrow is in status ${escrowAccount.status}; disputing requires HELD.`,
      );
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          engagementId: engagement.id,
          milestoneId: milestone.id,
          criterionId: criterion.id,
          escrowAccountId: escrowAccount.id,
          filedBy: filerId,
          state: DisputeState.LAYER_1_EVAL,
        },
      });

      await tx.escrowAccount.update({
        where: { id: escrowAccount.id },
        data: { status: EscrowStatus.FROZEN },
      });

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { state: MilestoneState.DISPUTED },
      });

      return created;
    });

    const latestSubmission = await this.prisma.milestoneSubmission.findFirst({
      where: { milestoneId: milestone.id },
      orderBy: { submittedAt: 'desc' },
    });

    let evalResult;
    try {
      evalResult = await this.fastapiClient.disputeEval({
        criterion_text: criterion.criterionText,
        deliverable_description: latestSubmission?.description ?? dto.additional_context ?? '',
        files: (latestSubmission?.filesJson as string[]) ?? [],
      });
    } catch (err) {
      // AI service unavailable — dispute stays in LAYER_1_EVAL, escrow
      // stays FROZEN (safe default), surface for retry.
      return {
        dispute_id: dispute.id,
        state: DisputeState.LAYER_1_EVAL,
        message: 'Dispute filed and escrow frozen. AI evaluation unavailable — will retry.',
      };
    }

    if (evalResult.confidence_score >= AUTO_RESOLVE_THRESHOLD) {
      const resolution: DisputeResolution = {
        decision: evalResult.finding === 'expert_wins' ? 'EXPERT_WINS' : 'CLIENT_WINS',
      };
      await this.applyResolution(dispute.id, resolution, evalResult.confidence_score);
 
      // platform_decisions write on the auto-resolve path only.
      await this.prisma.platformDecision.create({
        data: {
          decisionType: 'DISPUTE_L1_EVAL',
          entityType:   'disputes',
          entityId:     dispute.id,
          llmConfidence: evalResult.confidence_score,
          decision:     'AUTO_RESOLVED',
        },
      });
 
      return {
        dispute_id: dispute.id,
        state: DisputeState.AUTO_RESOLVED,
        finding: evalResult.finding,
        confidence_score: evalResult.confidence_score,
      };
    }

    await this.prisma.dispute.update({
      where: { id: dispute.id },
      data: { state: DisputeState.MANUAL_REVIEW, llmConfidence: evalResult.confidence_score },
    });

    return {
      dispute_id: dispute.id,
      state: DisputeState.MANUAL_REVIEW,
      confidence_score: evalResult.confidence_score,
      message: 'AI confidence below threshold — routed to Admin for manual review.',
    };
  }

  // Shared by the AI-auto path above AND AdminService's manual resolve.
  async applyResolution(
    disputeId: string,
    resolution: DisputeResolution,
    llmConfidence?: number,
    resolvedBy?: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found.');
    }
    if (dispute.state !== DisputeState.LAYER_1_EVAL && dispute.state !== DisputeState.MANUAL_REVIEW) {
      throw new ConflictException(`Dispute is in state ${dispute.state}; cannot resolve.`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (resolution.decision === 'EXPERT_WINS') {
        await tx.acceptanceCriterion.update({
          where: { id: dispute.criterionId },
          data: { verifiedAt: new Date(), revisionNote: null },
        });

        await tx.escrowAccount.update({
          where: { id: dispute.escrowAccountId },
          data: { status: EscrowStatus.HELD },
        });

        const unverifiedCount = await tx.acceptanceCriterion.count({
          where: { milestoneId: dispute.milestoneId!, isRequired: true, verifiedAt: null },
        });

        const otherOpenDisputes = await tx.dispute.count({
          where: {
            milestoneId: dispute.milestoneId!,
            id: { not: dispute.id },
            state: { in: [DisputeState.LAYER_1_EVAL, DisputeState.MANUAL_REVIEW] },
          },
        });

        if (unverifiedCount === 0 && otherOpenDisputes === 0) {
          await tx.milestone.update({
            where: { id: dispute.milestoneId! },
            data: { state: MilestoneState.APPROVED, approvedAt: new Date() },
          });
          await this.ledgerService.releaseMilestoneWithTx(tx, dispute.milestoneId!);
        } else {
          await tx.milestone.update({
            where: { id: dispute.milestoneId! },
            data: { state: MilestoneState.SUBMITTED },
          });
        }
      } else if (resolution.decision === 'CLIENT_WINS') {
        await this.ledgerService.refundEscrowWithTx(tx, dispute.escrowAccountId);
      } else if (resolution.decision === 'SPLIT') {
        await this.ledgerService.splitEscrowWithTx(tx, dispute.escrowAccountId);
      }

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          state: resolvedBy ? DisputeState.RESOLVED : DisputeState.AUTO_RESOLVED,
          llmConfidence: llmConfidence ?? dispute.llmConfidence,
          resolvedAt: new Date(),
          resolvedBy: resolvedBy ?? null,
        },
      });
    });
  }

  // GET /disputes/:id
  async findById(disputeId: string, user: ActorUser) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found.');
    }

    if (user.activeRole === 'ADMIN') return dispute;

    const engagement = await this.prisma.engagement.findUnique({ where: { id: dispute.engagementId } });
    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    const isParty =
      (user.activeRole === 'CLIENT' && engagement.clientId === user.id) ||
      (user.activeRole === 'EXPERT' && engagement.expertId === user.id);

    if (!isParty) {
      throw new ForbiddenException('You are not a party to this dispute.');
    }

    return dispute;
  }

  // GET /disputes — shared by DisputesController (own) and AdminController
  async findAll(user: ActorUser, filters?: { state?: string }) {
    
    // Include milestone and escrow account context for the Admin dashboard / general query clarity
    const includeRelations = {
      milestone: {
        select: { deliverableStatement: true, paymentAmountVnd: true }
      },
      escrowAccount: {
        select: { status: true, amount: true }
      }
    };

    if (user.activeRole === 'ADMIN') {
      return this.prisma.dispute.findMany({
        where: filters?.state ? { state: filters.state } : undefined,
        orderBy: { filedAt: 'desc' },
        include: includeRelations,
      });
    }

    const engagementFilter =
      user.activeRole === 'CLIENT'
        ? { clientId: user.id }
        : user.activeRole === 'EXPERT'
        ? { expertId: user.id }
        : null;

    if (!engagementFilter) {
      throw new ForbiddenException('Access denied.');
    }

    const engagements = await this.prisma.engagement.findMany({
      where: engagementFilter,
      select: { id: true },
    });

    return this.prisma.dispute.findMany({
      where: {
        engagementId: { in: engagements.map((e) => e.id) },
        ...(filters?.state ? { state: filters.state } : {}),
      },
      orderBy: { filedAt: 'desc' },
      include: includeRelations,
    });
  }
}