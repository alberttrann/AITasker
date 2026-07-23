import { Injectable, BadRequestException, NotFoundException, ConflictException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { LedgerService } from '@shared/ledger/ledger.service';
import { FastapiClient } from '../elicitation/fastapi.client';
import { generateVaNumber } from '@shared/ledger/va-generator';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { BulkInitializeMilestonesDto } from './dto/bulk-initialize-milestones.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { deriveMilestoneReviewAuthority } from './milestone-review-flow';
import {
  assertEngagementMilestoneTermsEditable,
  assertMilestoneTermsEditable,
  bidHasAcceptedTerms,
} from './milestone-terms-lock';

type MilestoneActor = Pick<AuthUser, 'id' | 'activeRole' | 'clientSubtype'>;
type EngagementAccess = {
  id: string;
  clientId: string;
  expertId: string;
  projectId: string | null;
  project?: {
    selfTechnical: boolean;
    techTeamProfiles?: Array<{ userId: string }>;
    elicitationSession?: {
      stage4TechInputsJson: unknown;
      handoffConsumedAt: Date | null;
    } | null;
  } | null;
};

const TECH_TEAM_USER_ID_KEY = '_tech_team_user_id';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  async getMilestone(milestoneId: string, user: MilestoneActor) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        acceptanceCriteria: true,
        dodItems: true,
        submissions: true,
        engagement: {
          select: {
            type: true,
            id: true,
            clientId: true,
            expertId: true,
            projectId: true,
            project: { select: { selfTechnical: true } },
            service: { select: { title: true } },
          },
        },
      },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found.');
    }
    await this.assertEngagementAccess(user, milestone.engagement);

    // Auto-heal missing criteria for service purchases
    const isServiceOrder = milestone.engagement?.type === 'SERVICE_PURCHASE' || milestone.engagement?.type === 'TECH_DISCOVERY';
    if (isServiceOrder && milestone.acceptanceCriteria.length === 0) {
      const defaultCriterion = await this.prisma.acceptanceCriterion.create({
        data: {
          milestoneId: milestone.id,
          criterionText: `Deliver and verify all requirements specified in the service: "${milestone.engagement?.service?.title || 'Service Listing'}"`,
          isRequired: true,
          verifiedByRole: milestone.signOffAuthority,
        },
      });
      milestone.acceptanceCriteria.push(defaultCriterion);
    }

    return milestone;
  }

  async createMilestone(dto: CreateMilestoneDto, user: MilestoneActor) {
    if (!dto.criteria || dto.criteria.length === 0) {
      throw new BadRequestException('At least one acceptance criterion is required.');
    }

    if (dto.payment_amount_vnd <= 0) {
      throw new BadRequestException('payment_amount_vnd must be greater than zero.');
    }

    const engagement = await this.getEngagementAccess(dto.engagement_id);
    this.assertCeoOwner(user, engagement);
    await assertEngagementMilestoneTermsEditable(this.prisma, dto.engagement_id);
    await this.assertReviewFlowReady(engagement);
    const signOffAuthority = deriveMilestoneReviewAuthority(engagement.project);

    const result = await this.prisma.$transaction(async (tx) => {
      let milestone;
      try {
        milestone = await tx.milestone.create({
          data: {
            engagementId:         dto.engagement_id,
            milestoneNumber:      dto.milestone_number,
            deliverableStatement: dto.deliverable_statement,
            signOffAuthority,
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

      const createdCriteria = [];
      for (const c of dto.criteria) {
        const criterion = await tx.acceptanceCriterion.create({
          data: {
            milestoneId:    milestone.id,
            criterionText:  c.criterion_text, 
            isRequired:     c.is_required ?? true, 
            verifiedByRole: signOffAuthority,
          },
        });
        createdCriteria.push(criterion);
      }

      return tx.milestone.findUnique({
        where:   { id: milestone.id },
        include: { acceptanceCriteria: true },
      });
    });

    if (result?.acceptanceCriteria) {
      for (const criterion of result.acceptanceCriteria) {
        try {
          const check = await this.fastapiClient.criterionCheck({
            criterion_text: criterion.criterionText,
          });

          if (check.is_subjective) {
            await this.prisma.platformDecision.create({
              data: {
                decisionType: 'CRITERION_QUALITY_GATE',
                entityType:   'acceptance_criteria',
                entityId:     criterion.id,
                decision:     'FLAGGED',
                advisoryNote: check.suggestions.join(' | ') || null,
              },
            });
          }
        } catch (err) {
          // Advisory-only
        }
      }
    }

    return result;
  }

  async initiateFunding(milestoneId: string, user: MilestoneActor) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        engagement: {
          include: { project: { select: { selfTechnical: true } } },
        },
      },
    });

    if (!milestone) {
      throw new BadRequestException('Milestone cannot be found');
    }
    this.assertCeoOwner(user, milestone.engagement);

    const isFreshFunding = milestone.state === 'DEFINED';
    let staleVa: { id: string; status: string } | null = null;

    if (!isFreshFunding) {
      if (milestone.state !== 'AWAITING_PAYMENT') {
        throw new UnprocessableEntityException(
          `Funding requires a DEFINED milestone, or an AWAITING_PAYMENT milestone with an expired, unpaid VA; current state is ${milestone.state}.`,
        );
      }
      if (!milestone.vaNumber) {
        throw new ConflictException(
          'Milestone is AWAITING_PAYMENT but has no associated VA number — cannot determine if regeneration is safe. Contact support.',
        );
      }
      staleVa = await this.prisma.virtualAccount.findUnique({
        where: { vaNumber: milestone.vaNumber },
        select: { id: true, status: true },
      });
      if (!staleVa) {
        throw new ConflictException(
          'Could not find the existing virtual account record for this milestone. Contact support before retrying.',
        );
      }
      if (staleVa.status === VAStatus.USED) {
        throw new ConflictException(
          'The existing virtual account for this milestone is marked USED (a payment may already be processing). Contact support before retrying — do not attempt to pay again.',
        );
      }
      const nowExpired = !milestone.vaExpiresAt || new Date(milestone.vaExpiresAt).getTime() < Date.now();
      if (staleVa.status === VAStatus.ACTIVE && !nowExpired) {
        throw new UnprocessableEntityException(
          'This milestone already has an active, unexpired payment window. Use the existing QR/VA instead of regenerating.',
        );
      }
    }

    if (milestone.engagement.type === 'PROJECT_BASED') {
      const engagement = await this.prisma.engagement.findUnique({
        where: { id: milestone.engagementId },
        include: { capabilityBid: true },
      });
      if (
        !engagement ||
        (engagement.state !== 'CONNECTED' && engagement.state !== 'ACTIVE') ||
        !engagement.clientNdaAcceptedAt ||
        !engagement.expertNdaAcceptedAt ||
        !bidHasAcceptedTerms(engagement.capabilityBid)
      ) {
        throw new UnprocessableEntityException({
          error: 'ACCEPTED_CONTRACT_AND_NDA_REQUIRED',
          message: 'Accepted terms and both NDA signatures are required before funding.',
        });
      }
    }

    const vaNumber = generateVaNumber(VAEntityType.MILESTONE);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      if (staleVa) {
        const closed = await tx.virtualAccount.updateMany({
          where: { id: staleVa.id, status: staleVa.status as any },
          data: { status: VAStatus.EXPIRED },
        });
        if (closed.count === 0) {
          throw new ConflictException(
            'The existing virtual account changed state while this request was processing (a payment may have just been received). Refresh and check the milestone status before retrying.',
          );
        }
      }

      await tx.virtualAccount.create({
        data: {
          entityType: VAEntityType.MILESTONE,
          entityId: milestoneId,
          vaNumber: vaNumber,
          fixedAmount: milestone.paymentAmountVnd,
          expiresAt,
          status: 'ACTIVE',
        },
      });

      return tx.milestone.update({
        where: { id: milestoneId },
        data: {
          state: 'AWAITING_PAYMENT',
          vaNumber: vaNumber,
          vaExpiresAt: expiresAt,
        },
      });
    });
  }

  async updateMilestone(milestoneId: string, userId: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        engagement: { select: { clientId: true, state: true } },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    if (milestone.engagement.clientId !== userId) {
      throw new ForbiddenException('Only the project CEO can edit milestones.');
    }
    await assertMilestoneTermsEditable(this.prisma, milestoneId);
    if (milestone.state !== 'DEFINED') {
      throw new UnprocessableEntityException(
        `Cannot edit a milestone in state '${milestone.state}'. Only DEFINED milestones can be edited.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update the milestone record
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(dto.title                !== undefined && { title: dto.title }),
          ...(dto.deliverable_statement !== undefined && { deliverableStatement: dto.deliverable_statement }),
          ...(dto.payment_amount_vnd   !== undefined && { paymentAmountVnd: BigInt(dto.payment_amount_vnd) }),
          ...(dto.estimated_duration_days !== undefined && { estimatedDurationDays: dto.estimated_duration_days }),
          ...(dto.tech_stack           !== undefined && { techStackJson: dto.tech_stack }),
          updatedAt: new Date(),
        },
      });

      if (dto.criteria && dto.criteria.length > 0) {
        await tx.acceptanceCriterion.deleteMany({
          where: { milestoneId },
        });

        for (const c of dto.criteria) {
          await tx.acceptanceCriterion.create({
            data: {
              milestone:      { connect: { id: milestoneId } },
              criterionText:  c.criterion_text,
              isRequired:     c.is_required ?? true,
              verifiedByRole: milestone.signOffAuthority,
            },
          });
        }
      }

      return tx.milestone.findUnique({
        where: { id: milestoneId },
        include: { acceptanceCriteria: true, dodItems: true },
      });
    });
  }

  async deleteMilestone(milestoneId: string, userId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { engagement: { select: { clientId: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    if (milestone.engagement.clientId !== userId) {
      throw new ForbiddenException('Only the project CEO can delete milestones.');
    }
    await assertMilestoneTermsEditable(this.prisma, milestoneId);
    if (milestone.state !== 'DEFINED') {
      throw new UnprocessableEntityException(
        `Cannot delete a milestone in state '${milestone.state}'. Only DEFINED milestones can be deleted.`,
      );
    }

    return this.prisma.milestone.delete({ where: { id: milestoneId } });
  }

  async listByEngagement(engagementId: string, user: MilestoneActor) {
    const engagement = await this.getEngagementAccess(engagementId);
    await this.assertEngagementAccess(user, engagement);
    return this.prisma.milestone.findMany({
      where: { engagementId },
      orderBy: { milestoneNumber: 'asc' },
      include: { acceptanceCriteria: true, dodItems: true },
    });
  }

  async getMilestoneDisputes(milestoneId: string, user: MilestoneActor) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        engagement: { include: { project: { select: { selfTechnical: true } } } },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    await this.assertEngagementAccess(user, milestone.engagement);
    return this.prisma.dispute.findMany({
      where: { milestoneId },
      orderBy: { filedAt: 'desc' },
      include: {
        criterion: { select: { criterionText: true } },
        milestone: {
          select: { deliverableStatement: true, paymentAmountVnd: true },
        },
        escrowAccount: { select: { status: true, amount: true } },
      },
    });
  }

  async bulkInitialize(user: MilestoneActor, dto: BulkInitializeMilestonesDto) {
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: dto.engagementId },
      include: {
        project: {
          select: {
            selfTechnical: true,
            techTeamProfiles: { take: 1, select: { userId: true } },
            elicitationSession: {
              select: { stage4TechInputsJson: true, handoffConsumedAt: true },
            },
          },
        },
      },
    });

    if (!engagement) throw new NotFoundException('Engagement not found.');
    this.assertCeoOwner(user, engagement);
    await assertEngagementMilestoneTermsEditable(this.prisma, dto.engagementId);
    await this.assertReviewFlowReady(engagement);
    const signOffAuthority = deriveMilestoneReviewAuthority(engagement.project);

    const existingCount = await this.prisma.milestone.count({
      where: { engagementId: dto.engagementId },
    });
    if (existingCount > 0) {
      throw new ConflictException('Milestones have already been initialized for this engagement.');
    }

    return this.prisma.$transaction(async (tx) => {
      const createdMilestones = [];

      for (const item of dto.milestones) {
        const milestone = await tx.milestone.create({
          data: {
            engagementId:         dto.engagementId,
            milestoneNumber:      item.milestoneNumber,
            deliverableStatement: item.deliverableStatement,
            signOffAuthority,
            paymentAmountVnd:     item.paymentAmountVnd,
            state:                'DEFINED',
          },
        });

        for (const c of item.criteria) {
          await tx.acceptanceCriterion.create({
            data: {
              milestone:      { connect: { id: milestone.id } },
              criterionText:  c.criterion_text,
              isRequired:     c.is_required ?? true,
              verifiedByRole: signOffAuthority,
            },
          });
        }

        const populated = await tx.milestone.findUnique({
          where: { id: milestone.id },
          include: { acceptanceCriteria: true },
        });
        createdMilestones.push(populated);
      }

      return createdMilestones;
    });
  }

  private async getEngagementAccess(engagementId: string): Promise<EngagementAccess> {
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: engagementId },
      include: {
        project: {
          select: {
            selfTechnical: true,
            techTeamProfiles: { take: 1, select: { userId: true } },
            elicitationSession: {
              select: { stage4TechInputsJson: true, handoffConsumedAt: true },
            },
          },
        },
      },
    });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    return engagement;
  }

  private assertCeoOwner(user: MilestoneActor, engagement: EngagementAccess): void {
    if (
      user.activeRole !== 'CLIENT' ||
      user.clientSubtype !== 'CEO' ||
      engagement.clientId !== user.id
    ) {
      throw new ForbiddenException('Only the project CEO can manage milestones.');
    }
  }

  private async assertReviewFlowReady(engagement: EngagementAccess): Promise<void> {
    if (
      !engagement.project ||
      engagement.project.selfTechnical ||
      engagement.project.techTeamProfiles?.length
    ) {
      return;
    }

    const stage4Inputs = engagement.project.elicitationSession?.stage4TechInputsJson;
    const recordedTechTeamUserId =
      stage4Inputs && typeof stage4Inputs === 'object' && !Array.isArray(stage4Inputs)
        ? (stage4Inputs as Record<string, unknown>)[TECH_TEAM_USER_ID_KEY]
        : undefined;

    if (engagement.projectId && typeof recordedTechTeamUserId === 'string') {
      const repaired = await this.prisma.techTeamProfile.updateMany({
        where: {
          userId: recordedTechTeamUserId,
          linkedClientId: engagement.clientId,
        },
        data: { linkedProjectId: engagement.projectId },
      });
      if (repaired.count === 1) {
        engagement.project.techTeamProfiles = [{ userId: recordedTechTeamUserId }];
        return;
      }
    }

    const unlinkedProfiles = await this.prisma.techTeamProfile.findMany({
      where: {
        linkedClientId: engagement.clientId,
        linkedProjectId: null,
      },
      select: { userId: true },
      take: 2,
    });

    if (engagement.projectId && unlinkedProfiles.length === 1) {
      const repaired = await this.prisma.techTeamProfile.updateMany({
        where: {
          userId: unlinkedProfiles[0].userId,
          linkedClientId: engagement.clientId,
          linkedProjectId: null,
        },
        data: { linkedProjectId: engagement.projectId },
      });
      if (repaired.count === 1) {
        engagement.project.techTeamProfiles = [unlinkedProfiles[0]];
        return;
      }
    }

    if (engagement.projectId && engagement.project.elicitationSession?.handoffConsumedAt) {
      const linkedProfiles = await this.prisma.techTeamProfile.findMany({
        where: { linkedClientId: engagement.clientId },
        select: { userId: true },
        take: 2,
      });
      if (linkedProfiles.length === 1) {
        const repaired = await this.prisma.techTeamProfile.updateMany({
          where: {
            userId: linkedProfiles[0].userId,
            linkedClientId: engagement.clientId,
          },
          data: { linkedProjectId: engagement.projectId },
        });
        if (repaired.count === 1) {
          engagement.project.techTeamProfiles = [linkedProfiles[0]];
          return;
        }
      }
    }

    throw new UnprocessableEntityException({
      error: 'TECH_TEAM_HANDOFF_REQUIRED',
      message:
        'The invited Tech Team must complete the handoff before milestones can be initialized.',
    });
  }

  private async assertEngagementAccess(
    user: MilestoneActor,
    engagement: EngagementAccess,
  ): Promise<void> {
    if (user.activeRole === 'ADMIN') return;
    if (user.activeRole === 'EXPERT' && engagement.expertId === user.id) return;
    if (
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'CEO' &&
      engagement.clientId === user.id
    ) {
      return;
    }
    if (
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'TECH_TEAM' &&
      engagement.projectId
    ) {
      const techTeam = await this.prisma.techTeamProfile.findUnique({
        where: { userId: user.id },
        select: { linkedProjectId: true },
      });
      if (techTeam?.linkedProjectId === engagement.projectId) return;
    }
    throw new ForbiddenException('Not a party to this engagement.');
  }
}