import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '../shared/ledger/ledger.service';
import { VerifyCriterionDto } from './dto/verify-criterion.dto';
import { RevisionNoteDto } from './dto/revision-note.dto';

@Injectable()
export class CriteriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async verify(id: string, dto: VerifyCriterionDto) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id },
      include: { milestone: true },
    });

    if (!criterion) {
      throw new NotFoundException('Criterion cannot be found in database.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Đánh dấu thời gian duyệt (verified_at) vào Database
      await tx.acceptanceCriterion.update({
        where: { id },
        data: {
          verifiedAt: new Date(),
          revisionNote: null, 
        },
      });

      const unverifiedCount = await tx.acceptanceCriterion.count({
        where: {
          milestoneId: criterion.milestoneId,
          isRequired: true,
          verifiedAt: null,
        },
      });

      if (unverifiedCount === 0) {
        await tx.milestone.update({
          where: { id: criterion.milestoneId },
          data: {
            state: 'APPROVED',
            approvedAt: new Date(),
          },
        });

        await this.ledgerService.releaseMilestone(criterion.milestoneId);
      }

      return { success: true, message: 'Criterion verified successfully.' };
    });
  }

  async requestRevision(id: string, dto: RevisionNoteDto) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id },
    });

    if (!criterion) {
      throw new NotFoundException('Criterion cannot be found in database.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.acceptanceCriterion.update({
        where: { id },
        data: {
          revisionNote: dto.revision_note,
          verifiedAt: null,
        },
      });

      await tx.milestone.update({
        where: { id: criterion.milestoneId },
        data: { state: 'IN_REVISION' },
      });

      return { success: true, message: 'Revision requested successfully.' };
    });
  }
}