import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService }      from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@Injectable()
export class MilestonesService {
  // Inject PrismaService để thao tác với các bảng dữ liệu
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


  async initiateFunding(milestoneId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id : milestoneId },
    });

    if (!milestone ) {
      throw new BadRequestException('Milestone cannot be found');
    }

    // Tạo một Mã tài khoản ảo VA (có 6 chữ số) cố định số tiền thông qua SePay 
    const vaNumber = `VA-${Math.floor(100000 + Math.random() * 900000)}`;

    // Tạo bản ghi trong bảng virtual_accounts để SePay IPN đối khớp sau này
    await this.prisma.virtualAccount.create({
      data: {
        entityType: 'MILESTONE',
        entityId: milestoneId,
        vaNumber: vaNumber,
        amountVnd: milestone.paymentAmountVnd,
        expiresAt : new Date(Date.now() + 24 * 60 * 60 * 1000), // Hết hạn sau 24 giờ
        status : 'ACTIVE',
      },
    });

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        state : 'AWAITING_PAYMENT',
        vaNumber: vaNumber,
        va_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), 
      },
    });
  }
  }
