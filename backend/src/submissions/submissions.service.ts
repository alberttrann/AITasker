import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { StagePaygatedDocDto } from './dto/stage-paygated-doc.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  //Expert nộp sản phẩm bàn giao (DoD Gate)
  async submitMilestones(milestoneId: string, expertId: string, dto: CreateSubmissionDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        engagement: {
          include: {
            project: {
              select: {
                selfTechnical: true,
                techTeamProfiles: { select: { userId: true } },
              },
            },
          },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
    }
    if (milestone.engagement.expertId !== expertId) {
      throw new ForbiddenException('Only the assigned expert can submit this milestone.');
    }
    if (!['FUNDED', 'IN_PROGRESS', 'IN_REVISION'].includes(milestone.state)) {
      throw new UnprocessableEntityException(
        `Cannot submit a milestone in state '${milestone.state}'.`,
      );
    }

    const incompleteRequiredDodCount = await this.prisma.milestoneDodItem.count({
      where: {
        milestoneId: milestoneId,
        isRequired: true,
        status: { not: 'COMPLETED' }, 
      },
    });

    if (incompleteRequiredDodCount > 0) {
      const incompleteItems = await this.prisma.milestoneDodItem.findMany({
        where: {
          milestoneId: milestoneId,
          isRequired: true,
          status: { not: 'COMPLETED' },
        },
        select: {
          id: true,
          itemDescription: true,
        },
      });

      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'REQUIRED_DOD_INCOMPLETE',
        message: 'You cannot submit deliverables while required DoD items are incomplete.',
        missing_items: incompleteItems, 
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.milestoneSubmission.create({
        data: {
          milestoneId: milestoneId,
          expertId: expertId,
          description: dto.description,
          filesJson: dto.files_json || [],
        },
      });

      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          state: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      const engagement = milestone.engagement;
      const linkedTechTeamIds =
        engagement.project && !engagement.project.selfTechnical
          ? engagement.project.techTeamProfiles.map((profile) => profile.userId)
          : [];
      const recipients = linkedTechTeamIds.length > 0
        ? linkedTechTeamIds.map((userId) => ({ userId, rolePath: 'tech-team' }))
        : [{ userId: engagement.clientId, rolePath: 'ceo' }];

      for (const recipient of recipients) {
        try {
          this.eventEmitter.emit('socket.broadcast', {
            userId: recipient.userId,
            event: 'milestone:updated',
            payload: {
              engagement_id: engagement.id,
              milestone_number: milestone.milestoneNumber,
              state: 'SUBMITTED',
              link: `/${recipient.rolePath}/engagements/${engagement.id}/milestones/${milestone.id}`,
            },
          });

          // Bắn thêm notification để hiện chuông đỏ
          this.eventEmitter.emit('socket.broadcast', {
            userId: recipient.userId,
            event: 'notification:generic',
            payload: {
              type: 'system',
              title: 'Deliverables Submitted',
              body: `The expert has submitted deliverables for Milestone #${milestone.milestoneNumber}. Please review them.`,
              link: `/${recipient.rolePath}/engagements/${engagement.id}/milestones/${milestone.id}`,
            },
          });
        } catch (_err) {
          // Best-effort: Nếu Socket/Redis lỗi thì vẫn cho qua, không làm rollback transaction của DB
        }
      }

      return submission;
    });
  }


    //Expert tải lên tài liệu bị khóa bằng cổng thanh toán (Stage Pay-gated Document)
    async uploadDocument(milestoneId: string, dto: StagePaygatedDocDto) {
        const milestone = await this.prisma.milestone.findUnique({
        where: { id: milestoneId },
    });

        if (!milestone) {
        throw new NotFoundException('Milestone cannot be found in database.');
        }

        const releaseState = ['DEFINED', 'AWAITING_PAYMENT'].includes(milestone.state) ? 'STAGED' : 'RELEASED';
        const releasedAt = releaseState === 'RELEASED' ? new Date() : null;

        return this.prisma.paygatedDocument.create({
        data: {
            milestoneId: milestoneId,
            documentUrl: dto.document_url,
            releaseState, 
            stagedAt: new Date(),
            releasedAt,
        },
        });
  }

  async downloadDocument(
    milestoneId: string,
    user: { id: string; activeRole: string; clientSubtype?: string | null },
  ) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { engagement: true },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
    }

    // Party-checks for highly sensitive artifact access
    const isExpertParty = user.activeRole === 'EXPERT' && milestone.engagement.expertId === user.id;
    const isAdmin = user.activeRole === 'ADMIN';

    let isLinkedTechTeam = false;
    if (
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'TECH_TEAM' &&
      milestone.engagement.projectId
    ) {
      const techProfile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: user.id },
      });
      isLinkedTechTeam = techProfile?.linkedProjectId === milestone.engagement.projectId;
    }

    if (!isExpertParty && !isLinkedTechTeam && !isAdmin) {
      throw new ForbiddenException(
        "You are not authorized to access this milestone's pay-gated documents.",
      );
    }

    const docs = await this.prisma.paygatedDocument.findMany({
      where: {
        milestoneId: milestoneId,
        releaseState: 'RELEASED',
      },
    });

    if (docs.length === 0) {
      const stagedCount = await this.prisma.paygatedDocument.count({
        where: {
          milestoneId: milestoneId,
          releaseState: 'STAGED',
        },
      });

      // Nếu có tài liệu nhưng chưa được nạp tiền -> Trả về lỗi 403 Forbidden
      if (stagedCount > 0) {
        throw new ForbiddenException(
          'These documents are locked until payment is secured in escrow.',
        );
      }

      // Nếu thực sự không tồn tại tệp nào -> Trả về lỗi 404 NotFound
      throw new NotFoundException('No released documents found for this milestone.');
    }

    return docs;
  }

  async uploadBulkDocuments(milestoneId: string, documentUrls: string[]) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
    }

    const releaseState = ['DEFINED', 'AWAITING_PAYMENT'].includes(milestone.state) ? 'STAGED' : 'RELEASED';
    const releasedAt = releaseState === 'RELEASED' ? new Date() : null;

    const result = await this.prisma.paygatedDocument.createMany({
      data: documentUrls.map((url) => ({
        milestoneId: milestoneId,
        documentUrl: url,
        releaseState,
        stagedAt: new Date(),
        releasedAt,
      })),
    });

    return { success: true, count: result.count };
  }

  async retractSubmission(milestoneId: string, expertUserId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { engagement: true },
    });

    if (!milestone) throw new NotFoundException('Milestone not found.');
    if (milestone.engagement.expertId !== expertUserId) {
      throw new ForbiddenException('Only the assigned expert can retract submitted deliverables.');
    }
    if (milestone.state !== 'SUBMITTED') {
      throw new UnprocessableEntityException(
        `Cannot retract submission: milestone is in state '${milestone.state}' (requires SUBMITTED).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete the latest submission record
      const latest = await tx.milestoneSubmission.findFirst({
        where: { milestoneId },
        orderBy: { submittedAt: 'desc' },
      });
      if (latest) {
        await tx.milestoneSubmission.delete({ where: { id: latest.id } });
      }

      // 2. Revert the milestone state back to IN_PROGRESS
      await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          state: 'IN_PROGRESS',
          submittedAt: null,
        },
      });

      // 3. Fire real-time update event so the CEO's UI updates instantly
      this.eventEmitter.emit('socket.broadcast', {
        userId: milestone.engagement.clientId,
        event: 'milestone:updated',
        payload: {
          engagement_id: milestone.engagementId,
          milestone_number: milestone.milestoneNumber,
          state: 'IN_PROGRESS',
        },
      });

      return { success: true, message: 'Submission successfully retracted.' };
    });
  }
  async listSubmissions(
    milestoneId: string,
    user: { id: string; activeRole: string; clientSubtype?: string | null }
  ) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { engagement: { select: { clientId: true, expertId: true, projectId: true } } },
    });

    if (!milestone) throw new NotFoundException('Milestone not found.');

    // Party-check validation
    const isAdmin = user.activeRole === 'ADMIN';
    const isClient = user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO' && milestone.engagement.clientId === user.id;
    const isExpert = user.activeRole === 'EXPERT' && milestone.engagement.expertId === user.id;
    
    let isTechTeam = false;
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'TECH_TEAM' && milestone.engagement.projectId) {
      const techProfile = await this.prisma.techTeamProfile.findUnique({ where: { userId: user.id } });
      isTechTeam = techProfile?.linkedProjectId === milestone.engagement.projectId;
    }

    if (!isAdmin && !isClient && !isExpert && !isTechTeam) {
      throw new ForbiddenException('Not a party to this engagement.');
    }

    return this.prisma.milestoneSubmission.findMany({
      where: { milestoneId },
      orderBy: { submittedAt: 'desc' }, // Order by newest first
    });
  }

  async getLatestSubmission(
    milestoneId: string,
    user: { id: string; activeRole: string; clientSubtype?: string | null }
  ) {
    // Re-use the list method to handle security and sorting
    const submissions = await this.listSubmissions(milestoneId, user);
    
    if (!submissions.length) {
      throw new NotFoundException('No submissions found for this milestone.');
    }
    
    return submissions[0]; // Return the first one (most recent)
  }
}
