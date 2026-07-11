import { Injectable, BadRequestException, NotFoundException, ConflictException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { MilestoneState } from '@common/enums/milestone-state.enum';
import { LedgerService } from '@shared/ledger/ledger.service';
import { FastapiClient } from '../elicitation/fastapi.client';
import { generateVaNumber } from '@shared/ledger/va-generator';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

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
      include: { acceptanceCriteria: true, dodItems: true },
    });
    if (!milestone) {
      throw new NotFoundException('Milestone not found.');
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

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.deliverable_statement !== undefined && {
          deliverableStatement: dto.deliverable_statement,
        }),
        ...(dto.sign_off_authority !== undefined && { signOffAuthority: dto.sign_off_authority }),
        ...(dto.payment_amount_vnd !== undefined && {
          paymentAmountVnd: BigInt(dto.payment_amount_vnd),
        }),
        ...(dto.estimated_duration_days !== undefined && {
          estimatedDurationDays: dto.estimated_duration_days,
        }),
        ...(dto.tech_stack !== undefined && { techStackJson: dto.tech_stack }),
        updatedAt: new Date(),
      },
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
}
