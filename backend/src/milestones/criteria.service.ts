// backend/src/milestones/criteria.service.ts
// CHANGED: verify()'s auto-release trigger now checks for any OPEN
// dispute on this milestone before releasing — closes the race flagged
// in the design writeup (a dispute pending on one criterion shouldn't be
// silently bypassed by the other criteria completing and triggering
// release anyway).
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
        // ADDED: don't auto-release while ANY dispute on this milestone is
        // still open — even though every OTHER criterion is now verified,
        // an open dispute means this milestone isn't actually ready for
        // normal completion yet.
        const openDispute = await tx.dispute.findFirst({
          where: {
            milestoneId: criterion.milestoneId,
            state: { in: [DisputeState.PENDING, DisputeState.ESCALATED] },
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
}