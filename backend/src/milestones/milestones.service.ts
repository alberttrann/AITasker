import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { VAEntityType }       from '@common/enums/va-entity-type.enum';

@Injectable()
export class MilestonesService {
  constructor(private readonly prisma: PrismaService) {}

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

  // ── initiateFunding ──────────────────────────────────────────────────────
  // corrected:
  //   amountVnd        -> fixedAmount   (VirtualAccount has no amountVnd field)
  //   va_expires_at    -> vaExpiresAt   (Prisma requires camelCase, not the
  //                                       raw snake_case column name)
  async initiateFunding(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new BadRequestException('Milestone cannot be found');
    }

    const vaNumber = `VA-${Math.floor(100000 + Math.random() * 900000)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.virtualAccount.create({
      data: {
        entityType:  VAEntityType.MILESTONE,
        entityId:    milestoneId,
        vaNumber:    vaNumber,
        fixedAmount: milestone.paymentAmountVnd,
        expiresAt:   expiresAt,
        status:      'ACTIVE',
      },
    });

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        state:       'AWAITING_PAYMENT',
        vaNumber:    vaNumber,
        vaExpiresAt: expiresAt,
      },
    });
  }
}