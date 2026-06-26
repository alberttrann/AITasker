import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { StagePaygatedDocDto } from './dto/stage-paygated-doc.dto';

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitMilestones(milestoneId: string, dto: CreateSubmissionDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
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
          expertId: dto.expert_id,
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

      return submission;
    });
  }

  async uploadDocument(milestoneId: string, dto: StagePaygatedDocDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
    }

    return this.prisma.paygatedDocument.create({
      data: {
        milestoneId: milestoneId,
        documentUrl: dto.document_url,
        releaseState: 'STAGED',
        stagedAt: new Date(),
      },
    });
  }

  async downloadDocument(milestoneId: string) {
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

      if (stagedCount > 0) {
        throw new ForbiddenException(
          'These documents are locked until payment is secured in escrow.',
        );
      }

      throw new NotFoundException('No released documents found for this milestone.');
    }

    return docs;
  }
}