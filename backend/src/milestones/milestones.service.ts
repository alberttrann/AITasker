import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

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

    // FIX [BLOCK-8]: milestone + criteria must be atomic.
    // If criteria insertion fails, the milestone is rolled back automatically.
    return this.prisma.$transaction(async (tx) => {

      // Count existing milestones inside the transaction to minimise the
      // numbering race condition. The unique DB index on
      // (engagement_id, milestone_number) is the hard safety net.
      const existingCount = await tx.milestone.count({
        where: { engagementId: dto.engagement_id },
      });

      const milestone = await tx.milestone.create({
        data: {
          engagementId:         dto.engagement_id,
          milestoneNumber:      existingCount + 1,
          deliverableStatement: dto.deliverable_statement,
          signOffAuthority:     dto.sign_off_authority,
          paymentAmountVnd:     dto.payment_amount_vnd,
          state:                'DEFINED',
        },
      });

      // FIX [BLOCK-6]: criteria were validated but never written to DB.
      // FIX [BLOCK-7]: verified_by_role is NOT NULL in schema.
      //   At creation time criteria are not yet verified (verified_at stays null).
      //   verifiedByRole defaults to sign_off_authority — that actor is responsible
      //   for signing off each criterion at milestone approval time.
      await tx.acceptanceCriterion.createMany({
        data: dto.criteria.map((c) => ({
          milestoneId:    milestone.id,
          criterionText:  c.criterion_text,
          isRequired:     c.is_required ?? true,
          verifiedByRole: dto.sign_off_authority,
        })),
      });

      // Return milestone with persisted criteria so callers see the full record.
      return tx.milestone.findUnique({
        where:   { id: milestone.id },
        include: { acceptanceCriteria: true },
      });
    });
  }
}