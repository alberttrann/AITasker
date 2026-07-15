import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '../shared/ledger/ledger.service';
import { DisputeState } from '@common/enums/dispute-state.enum';
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
        const openDispute = await tx.dispute.findFirst({
          where: {
            milestoneId: criterion.milestoneId,
            state: { in: [DisputeState.LAYER_1_EVAL, DisputeState.MANUAL_REVIEW] },
          },
        });

        if (openDispute) {
          return {
            success: true,
            message: 'Criterion verified, but milestone has an open dispute — release held until resolved.',
          };
        }

        await tx.milestone.update({
          where: { id: criterion.milestoneId },
          data: {
            state: 'APPROVED',
            approvedAt: new Date(),
          },
        });

        await this.ledgerService.releaseMilestoneWithTx(tx, criterion.milestoneId);
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

  async listCriteria(milestoneId: string) {
    return this.prisma.acceptanceCriterion.findMany({
      where: { milestoneId },
      orderBy: { id: 'asc' }, 
    });
  }

  async create(milestoneId: string, dto: { criterion_text: string; is_required?: boolean }) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    
    // Connect via relation to satisfy the compiler and pass the required verifiedByRole
    return this.prisma.acceptanceCriterion.create({
      data: {
        milestone: { connect: { id: milestoneId } }, 
        criterionText: dto.criterion_text,
        isRequired: dto.is_required ?? true,
        verifiedByRole: milestone.signOffAuthority, 
      },
    });
  }

  async deleteCriterion(id: string) {
    const c = await this.prisma.acceptanceCriterion.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Criterion not found.');
    return this.prisma.acceptanceCriterion.delete({ where: { id } });
  }
}