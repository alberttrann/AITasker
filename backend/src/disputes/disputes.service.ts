// backend/src/disputes/disputes.service.ts
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

const AI_CONFIDENCE_THRESHOLD = 0.80; // per the Zone 4 diagram

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

    // Phase 1 — file + freeze, atomically. Protects the escrow immediately,
    // regardless of how long the subsequent AI call takes.
    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          engagementId: engagement.id,
          milestoneId: milestone.id,
          criterionId: criterion.id,
          escrowAccountId: escrowAccount.id,
          filedBy: filerId,
          state: DisputeState.PENDING,
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

    // Phase 2 — AI evaluation (external call, outside any transaction).
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
      // AI service unavailable — leave the dispute PENDING, escrow stays
      // FROZEN (safe default), surface for retry rather than escalating
      // blindly or losing the filing.
      return {
        dispute_id: dispute.id,
        state: DisputeState.PENDING,
        message: 'Dispute filed and escrow frozen. AI evaluation unavailable — will retry.',
      };
    }

    // Phase 3 — apply or escalate based on confidence.
    if (evalResult.confidence_score >= AI_CONFIDENCE_THRESHOLD) {
      const resolution: DisputeResolution = {
        decision: evalResult.finding === 'expert_wins' ? 'EXPERT_WINS' : 'CLIENT_WINS',
      };
      await this.applyResolution(dispute.id, resolution, evalResult.confidence_score);
      return {
        dispute_id: dispute.id,
        state: DisputeState.AI_RESOLVED,
        finding: evalResult.finding,
        confidence_score: evalResult.confidence_score,
      };
    }

    await this.prisma.dispute.update({
      where: { id: dispute.id },
      data: { state: DisputeState.ESCALATED, llmConfidence: evalResult.confidence_score },
    });

    return {
      dispute_id: dispute.id,
      state: DisputeState.ESCALATED,
      confidence_score: evalResult.confidence_score,
      message: 'AI confidence below threshold — escalated to Admin for manual review.',
    };
  }

  // Shared by the AI-auto path above AND AdminService's manual resolve.
  // resolvedBy is omitted (stays null) for AI auto-resolution — no human
  // decision-maker to record.
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
    if (dispute.state !== DisputeState.PENDING && dispute.state !== DisputeState.ESCALATED) {
      throw new ConflictException(`Dispute is in state ${dispute.state}; cannot resolve.`);
    }

    await this.prisma.$transaction(async (tx) => {
      if (resolution.decision === 'EXPERT_WINS') {
        // Mark the disputed criterion verified, then check if this
        // satisfies the milestone's release condition (mirrors
        // CriteriaService.verify()'s logic — duplicated narrowly here
        // rather than refactored to share, given the differing
        // transaction-composition needs; flagged as a minor consolidation
        // opportunity for later, not urgent).
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
            state: { in: [DisputeState.PENDING, DisputeState.ESCALATED] },
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
        if (resolution.expertSharePercent === undefined) {
          throw new UnprocessableEntityException('expertSharePercent is required for a SPLIT decision.');
        }
        await this.ledgerService.splitEscrowWithTx(tx, dispute.escrowAccountId, resolution.expertSharePercent);
      }

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          state: resolvedBy ? DisputeState.ADMIN_RESOLVED : DisputeState.AI_RESOLVED,
          llmConfidence: llmConfidence ?? dispute.llmConfidence,
          resolvedAt: new Date(),
          resolvedBy: resolvedBy ?? null,
        },
      });
    });
  }

  // PUT /disputes/:id/withdraw
  async withdraw(disputeId: string, userId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found.');
    }
    if (dispute.filedBy !== userId) {
      throw new ForbiddenException('Only the original filer can withdraw this dispute.');
    }
    if (dispute.state !== DisputeState.PENDING && dispute.state !== DisputeState.ESCALATED) {
      throw new ConflictException(`Dispute is in state ${dispute.state}; cannot withdraw.`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: { state: DisputeState.WITHDRAWN, resolvedAt: new Date() },
      });

      await tx.escrowAccount.update({
        where: { id: dispute.escrowAccountId },
        data: { status: EscrowStatus.HELD },
      });

      if (dispute.milestoneId) {
        await tx.milestone.update({
          where: { id: dispute.milestoneId },
          data: { state: MilestoneState.SUBMITTED },
        });
      }

      return { success: true };
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

  // GET /disputes — shared by both DisputesController (own) and
  // AdminController (queue view, where user.activeRole === 'ADMIN' sees all).
  async findAll(user: ActorUser, filters?: { state?: string }) {
    if (user.activeRole === 'ADMIN') {
      return this.prisma.dispute.findMany({
        where: filters?.state ? { state: filters.state } : undefined,
        orderBy: { filedAt: 'desc' },
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
    });
  }
}