import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '../shared/ledger/ledger.service';
import { DisputeState } from '@common/enums/dispute-state.enum';
import { VerifyCriterionDto } from './dto/verify-criterion.dto';
import { RevisionNoteDto } from './dto/revision-note.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  deriveMilestoneReviewAuthority,
  requiresTechReview,
} from './milestone-review-flow';
import { assertMilestoneTermsEditable } from './milestone-terms-lock';

type Reviewer = Pick<AuthUser, 'id' | 'activeRole' | 'clientSubtype'>;

const CRITERION_CONTEXT_INCLUDE = {
  milestone: {
    include: {
      engagement: {
        include: { project: { select: { selfTechnical: true } } },
      },
    },
  },
} as const;

@Injectable()
export class CriteriaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async verify(id: string, _dto: VerifyCriterionDto, user: Reviewer) {
    const criterion = await this.getCriterionContext(id);
    const reviewerRole = await this.assertActiveReviewer(criterion, user);

    if (reviewerRole === 'TECH_TEAM' && criterion.techVerifiedAt) {
      throw new ConflictException({
        error: 'REVIEW_STAGE_COMPLETE',
        message: 'This criterion has already been signed off by the Tech Team.',
      });
    }
    if (reviewerRole === 'CEO' && criterion.ceoVerifiedAt) {
      throw new ConflictException({
        error: 'REVIEW_STAGE_COMPLETE',
        message: 'This criterion has already been signed off by the CEO.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      if (reviewerRole === 'TECH_TEAM') {
        await tx.acceptanceCriterion.update({
          where: { id },
          data: {
            techVerifiedAt: now,
            revisionNote: null,
            revisionRequestedByRole: null,
          },
        });

        const remainingTechReviews = await tx.acceptanceCriterion.count({
          where: {
            milestoneId: criterion.milestoneId,
            isRequired: true,
            techVerifiedAt: null,
          },
        });

        return {
          success: true,
          reviewStage: remainingTechReviews === 0 ? 'CEO' : 'TECH_TEAM',
          message:
            remainingTechReviews === 0
              ? 'Tech Team review complete. The milestone is ready for CEO sign-off.'
              : 'Criterion signed off by the Tech Team.',
        };
      }

      await tx.acceptanceCriterion.update({
        where: { id },
        data: {
          ceoVerifiedAt: now,
          verifiedAt: now,
          revisionNote: null,
          revisionRequestedByRole: null,
        },
      });

      const remainingCeoReviews = await tx.acceptanceCriterion.count({
        where: {
          milestoneId: criterion.milestoneId,
          isRequired: true,
          ceoVerifiedAt: null,
        },
      });

      if (remainingCeoReviews > 0) {
        return {
          success: true,
          reviewStage: 'CEO',
          message: 'Criterion signed off by the CEO.',
        };
      }

      const openDispute = await tx.dispute.findFirst({
        where: {
          milestoneId: criterion.milestoneId,
          state: { in: [DisputeState.LAYER_1_EVAL, DisputeState.MANUAL_REVIEW] },
        },
      });

      if (openDispute) {
        return {
          success: true,
          reviewStage: 'COMPLETE',
          message:
            'Criterion verified, but the milestone has an open dispute. Release is held until it is resolved.',
        };
      }

      const approval = await tx.milestone.updateMany({
        where: { id: criterion.milestoneId, state: 'SUBMITTED' },
        data: { state: 'APPROVED', approvedAt: now },
      });

      if (approval.count === 1) {
        await this.ledgerService.releaseMilestoneWithTx(tx, criterion.milestoneId);

        const unapprovedCount = await tx.milestone.count({
          where: {
            engagementId: criterion.milestone.engagementId,
            state: { notIn: ['APPROVED', 'RELEASED'] },
          },
        });

        if (unapprovedCount === 0) {
          await tx.engagement.update({
            where: { id: criterion.milestone.engagementId },
            data: { state: 'CLOSED' },
          });
        }
      }

      return {
        success: true,
        reviewStage: 'COMPLETE',
        message: 'Final CEO sign-off complete. Milestone approved.',
      };
    });

    if (reviewerRole === 'TECH_TEAM' && result.reviewStage === 'CEO') {
      this.eventEmitter.emit('socket.broadcast', {
        userId: criterion.milestone.engagement.clientId,
        event: 'milestone:updated',
        payload: {
          engagement_id: criterion.milestone.engagement.id,
          milestone_id: criterion.milestoneId,
          milestone_number: criterion.milestone.milestoneNumber,
          state: 'SUBMITTED',
          review_stage: 'CEO',
          link: `/ceo/engagements/${criterion.milestone.engagement.id}/milestones/${criterion.milestoneId}`,
        },
      });
    }

    if (result.reviewStage === 'COMPLETE') {
      const engagement = criterion.milestone.engagement;
      const recipientIds = new Set<string>([
        engagement.clientId,
        engagement.expertId,
      ]);

      if (engagement.projectId) {
        const techProfiles = await this.prisma.techTeamProfile.findMany({
          where: { linkedProjectId: engagement.projectId },
          select: { userId: true },
        });
        techProfiles.forEach((tp) => recipientIds.add(tp.userId));
      }

      for (const userId of recipientIds) {
        let rolePath = 'ceo';
        if (userId === engagement.expertId) {
          rolePath = 'expert';
        } else if (userId !== engagement.clientId) {
          rolePath = 'tech-team';
        }

        this.eventEmitter.emit('socket.broadcast', {
          userId,
          event: 'milestone:updated',
          payload: {
            engagement_id: engagement.id,
            milestone_id: criterion.milestoneId,
            milestone_number: criterion.milestone.milestoneNumber,
            state: 'APPROVED',
            review_stage: 'COMPLETE',
            link: `/${rolePath}/engagements/${engagement.id}/milestones/${criterion.milestoneId}`,
          },
        });
      }
    }

    return result;
  }

  async requestRevision(id: string, dto: RevisionNoteDto, user: Reviewer) {
    const criterion = await this.getCriterionContext(id);
    const reviewerRole = await this.assertActiveReviewer(criterion, user);

    if (reviewerRole === 'TECH_TEAM' && criterion.techVerifiedAt) {
      throw new ConflictException({
        error: 'REVIEW_STAGE_COMPLETE',
        message: 'A signed-off Tech Team criterion cannot request revision.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.acceptanceCriterion.update({
        where: { id },
        data: {
          revisionNote: dto.revision_note,
          revisionRequestedByRole: reviewerRole,
          verifiedAt: null,
          ceoVerifiedAt: null,
          ...(requiresTechReview(criterion.milestone.signOffAuthority) && {
            techVerifiedAt: null,
          }),
        },
      });

      await tx.milestone.update({
        where: { id: criterion.milestoneId },
        data: { state: 'IN_REVISION' },
      });

      return {
        success: true,
        reviewStage: requiresTechReview(criterion.milestone.signOffAuthority)
          ? 'TECH_TEAM'
          : 'CEO',
        message: 'Revision requested successfully.',
      };
    });

    const engagement = criterion.milestone.engagement;
    const recipientIds = new Set<string>([
      engagement.clientId,
      engagement.expertId,
    ]);

    if (engagement.projectId) {
      const techProfiles = await this.prisma.techTeamProfile.findMany({
        where: { linkedProjectId: engagement.projectId },
        select: { userId: true },
      });
      techProfiles.forEach((tp) => recipientIds.add(tp.userId));
    }

    for (const userId of recipientIds) {
      let rolePath = 'ceo';
      if (userId === engagement.expertId) {
        rolePath = 'expert';
      } else if (userId !== engagement.clientId) {
        rolePath = 'tech-team';
      }

      this.eventEmitter.emit('socket.broadcast', {
        userId,
        event: 'milestone:updated',
        payload: {
          engagement_id: engagement.id,
          milestone_id: criterion.milestoneId,
          milestone_number: criterion.milestone.milestoneNumber,
          state: 'IN_REVISION',
          revision_requested_by: reviewerRole,
          link: `/${rolePath}/engagements/${engagement.id}/milestones/${criterion.milestoneId}`,
        },
      });
    }

    return result;
  }

  async listCriteria(milestoneId: string, user: Reviewer) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { engagement: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    await this.assertReadAccess(milestone.engagement, user);

    return this.prisma.acceptanceCriterion.findMany({
      where: { milestoneId },
      orderBy: { id: 'asc' },
    });
  }

  async create(
    milestoneId: string,
    dto: { criterion_text: string; is_required?: boolean },
    user: Reviewer,
  ) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        engagement: { include: { project: { select: { selfTechnical: true } } } },
      },
    });
    if (!milestone) throw new NotFoundException('Milestone not found.');
    this.assertCeoOwner(milestone.engagement, user);
    await assertMilestoneTermsEditable(this.prisma, milestoneId);
    if (milestone.state !== 'DEFINED') {
      throw new UnprocessableEntityException(
        'Acceptance criteria can only be added while the milestone is DEFINED.',
      );
    }

    const verifiedByRole = deriveMilestoneReviewAuthority(milestone.engagement.project);
    return this.prisma.acceptanceCriterion.create({
      data: {
        milestone: { connect: { id: milestoneId } },
        criterionText: dto.criterion_text,
        isRequired: dto.is_required ?? true,
        verifiedByRole,
      },
    });
  }

  async deleteCriterion(id: string, user: Reviewer) {
    const criterion = await this.getCriterionContext(id);
    this.assertCeoOwner(criterion.milestone.engagement, user);
    await assertMilestoneTermsEditable(this.prisma, criterion.milestoneId);
    if (criterion.milestone.state !== 'DEFINED') {
      throw new UnprocessableEntityException(
        'Acceptance criteria can only be deleted while the milestone is DEFINED.',
      );
    }
    return this.prisma.acceptanceCriterion.delete({ where: { id } });
  }

  private async getCriterionContext(id: string) {
    const criterion = await this.prisma.acceptanceCriterion.findUnique({
      where: { id },
      include: CRITERION_CONTEXT_INCLUDE,
    });
    if (!criterion) {
      throw new NotFoundException('Criterion cannot be found in database.');
    }
    return criterion;
  }

  private async assertActiveReviewer(
    criterion: Awaited<ReturnType<CriteriaService['getCriterionContext']>>,
    user: Reviewer,
  ): Promise<'TECH_TEAM' | 'CEO'> {
    if (criterion.milestone.state !== 'SUBMITTED') {
      throw new UnprocessableEntityException({
        error: 'MILESTONE_NOT_SUBMITTED',
        message: 'Criteria can only be reviewed while the milestone is SUBMITTED.',
      });
    }

    const engagement = criterion.milestone.engagement;
    const authority = deriveMilestoneReviewAuthority(engagement.project);
    const techReviewRequired = requiresTechReview(authority);

    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'TECH_TEAM') {
      if (!techReviewRequired || !engagement.projectId) {
        this.throwReviewerForbidden('This milestone does not require Tech Team review.');
      }
      const profile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: user.id },
        select: { linkedProjectId: true },
      });
      if (profile?.linkedProjectId !== engagement.projectId) {
        this.throwReviewerForbidden('You are not linked to this milestone project.');
      }
      return 'TECH_TEAM';
    }

    if (
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'CEO' &&
      engagement.clientId === user.id
    ) {
      if (techReviewRequired) {
        const remainingTechReviews = await this.prisma.acceptanceCriterion.count({
          where: {
            milestoneId: criterion.milestoneId,
            isRequired: true,
            techVerifiedAt: null,
          },
        });
        if (remainingTechReviews > 0) {
          throw new UnprocessableEntityException({
            error: 'TECH_REVIEW_REQUIRED',
            message: 'The linked Tech Team must sign off all required criteria first.',
          });
        }
      }
      return 'CEO';
    }

    this.throwReviewerForbidden('You are not authorized to review this criterion.');
  }

  private async assertReadAccess(
    engagement: { clientId: string; expertId: string; projectId: string | null },
    user: Reviewer,
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
      const profile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: user.id },
        select: { linkedProjectId: true },
      });
      if (profile?.linkedProjectId === engagement.projectId) return;
    }
    throw new ForbiddenException('Not a party to this engagement.');
  }

  private assertCeoOwner(
    engagement: { clientId: string },
    user: Reviewer,
  ): void {
    if (
      user.activeRole !== 'CLIENT' ||
      user.clientSubtype !== 'CEO' ||
      engagement.clientId !== user.id
    ) {
      this.throwReviewerForbidden('Only the project CEO can manage acceptance criteria.');
    }
  }

  private throwReviewerForbidden(message: string): never {
    throw new ForbiddenException({ error: 'REVIEWER_NOT_AUTHORIZED', message });
  }
}
