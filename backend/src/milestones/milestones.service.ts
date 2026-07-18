import { Injectable, BadRequestException, NotFoundException, ConflictException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { LedgerService } from '@shared/ledger/ledger.service';
import { FastapiClient } from '../elicitation/fastapi.client';
import { generateVaNumber } from '@shared/ledger/va-generator';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { BulkInitializeMilestonesDto } from './dto/bulk-initialize-milestones.dto';
@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  async getMilestone(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        acceptanceCriteria: true,
        dodItems: true,
        submissions: true,
        engagement: {
          select: {
            type: true,
            service: { select: { title: true } },
          },
        },
      },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found.');
    }

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

  async createMilestone(dto: CreateMilestoneDto) {
    if (!dto.criteria || dto.criteria.length === 0) {
      throw new BadRequestException('At least one acceptance criterion is required.');
    }

    if (dto.payment_amount_vnd <= 0) {
      throw new BadRequestException('payment_amount_vnd must be greater than zero.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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

      const createdCriteria = [];
      for (const c of dto.criteria) {
        const criterion = await tx.acceptanceCriterion.create({
          data: {
            milestoneId:    milestone.id,
            criterionText:  c.criterion_text, 
            isRequired:     c.is_required ?? true, 
            verifiedByRole: dto.sign_off_authority,
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
          // Advisory-only — swallow and move on. Milestone/criteria are
          // already safely persisted regardless of this outcome.
        }
      }
    }

    return result;
  }

  async initiateFunding(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new BadRequestException('Milestone cannot be found');
    }

    const vaNumber = generateVaNumber(VAEntityType.MILESTONE);

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
          ...(dto.sign_off_authority   !== undefined && { signOffAuthority: dto.sign_off_authority }),
          ...(dto.payment_amount_vnd   !== undefined && { paymentAmountVnd: BigInt(dto.payment_amount_vnd) }),
          ...(dto.estimated_duration_days !== undefined && { estimatedDurationDays: dto.estimated_duration_days }),
          ...(dto.tech_stack           !== undefined && { techStackJson: dto.tech_stack }),
          updatedAt: new Date(),
        },
      });

      // 2. If the criteria checklist was updated, replace it atomically (Issue fix)
      if (dto.criteria && dto.criteria.length > 0) {
        // Delete all old criteria for this milestone
        await tx.acceptanceCriterion.deleteMany({
          where: { milestoneId },
        });

        // Insert the newly provided ones
        for (const c of dto.criteria) {
          await tx.acceptanceCriterion.create({
            data: {
              milestone:      { connect: { id: milestoneId } },
              criterionText:  c.criterion_text,
              isRequired:     c.is_required ?? true,
              verifiedByRole: dto.sign_off_authority ?? milestone.signOffAuthority,
            },
          });
        }
      }

      // Return fully populated milestone with its updated criteria checklist included
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
    if (milestone.state !== 'DEFINED') {
      throw new UnprocessableEntityException(
        `Cannot delete a milestone in state '${milestone.state}'. Only DEFINED milestones can be deleted.`,
      );
    }

    return this.prisma.milestone.delete({ where: { id: milestoneId } });
  }

  async listByEngagement(engagementId: string) {
    return this.prisma.milestone.findMany({
      where: { engagementId },
      orderBy: { milestoneNumber: 'asc' },
      include: { acceptanceCriteria: true, dodItems: true },
    });
  }

  async getMilestoneDisputes(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    return this.prisma.dispute.findMany({
      where: { milestoneId },
      orderBy: { filedAt: 'desc' }, 
    });
  }

  async bulkInitialize(userId: string, dto: BulkInitializeMilestonesDto) {
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: dto.engagementId },
    });

    if (!engagement) throw new NotFoundException('Engagement not found.');
    if (engagement.clientId !== userId) {
      throw new ForbiddenException('Only the project CEO can initialize milestones.');
    }

    // Anti-Spam: Block if milestones have already been initialized
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
            signOffAuthority:     item.signOffAuthority,
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
              verifiedByRole: item.signOffAuthority,
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
}