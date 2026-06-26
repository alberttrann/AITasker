import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { PrismaService } from 'prisma/prisma.service';
import { EngagementState } from '@common/enums/engagement-state.enum';
import { ActiveRole } from '@common/enums/active-role.enum';
import { ClientSubType } from '@common/enums/client-subtype.enum';
import { ReviewerRole } from '@common/enums/reviewer-role.enum';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(userId: string, createReviewDto: CreateReviewDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("You don't have permission to access!");
    }

    const engagement = await this.prisma.engagement.findUnique({
      where: { id: createReviewDto.engagementId },
    });

    if (!engagement) {
      throw new BadRequestException('Engagement not found');
    }

    if (!(engagement.state === EngagementState.CLOSED)) {
      throw new ConflictException('This engagement is not closed yet!');
    }

    const userActiveRole = user.activeRole;

    const reviewerRole =
      userActiveRole === ActiveRole.CLIENT
        ? user.clientSubtype === ClientSubType.CEO
          ? ReviewerRole.CEO
          : ReviewerRole.TECH_TEAM
        : ReviewerRole.EXPERT;

    const isExistedReview = await this.prisma.review.findFirst({
      where: {
        engagementId: createReviewDto.engagementId,
        reviewerId: user.id,
      },
    });

    if (isExistedReview) {
      throw new ConflictException('You have made this review before!');
    }

    let parsedSignal;

    switch (reviewerRole) {
      case ReviewerRole.CEO:
        if (engagement.clientId !== user.id) {
          throw new ForbiddenException('You are not a party to this engagement');
        }

        if (createReviewDto.targetId !== engagement.expertId) {
          throw new ForbiddenException('CEO can only review the expert on this engagement');
        }
        break;

      case ReviewerRole.TECH_TEAM:
        const isBelongTechTeamProfile = await this.prisma.techTeamProfile.findFirst({
          where: {
            userId: user.id,
            linkedProjectId: engagement.projectId,
          },
        });

        if (!isBelongTechTeamProfile) {
          throw new ForbiddenException('Not a TECH_TEAM party to this engagement');
        }

        if (createReviewDto.targetId !== engagement.expertId) {
          throw new ForbiddenException('TECH_TEAM can only review the expert on this engagement');
        }

        if (!createReviewDto.structuredSignalsJson) {
          throw new BadRequestException('structuredSignalsJson is required for TECH_TEAM');
        }

        try {
          parsedSignal = JSON.parse(createReviewDto.structuredSignalsJson);
        } catch {
          throw new BadRequestException('structuredSignalsJson must be a valid JSON');
        }

        break;

      case ReviewerRole.EXPERT:
        if (engagement.expertId !== user.id) {
          throw new ForbiddenException('Not the expert on this engagement');
        }

        if (createReviewDto.targetId !== engagement.clientId) {
          throw new ForbiddenException('Expert can only review the client on this engagement');
        }
    }

    const review = await this.prisma.review.create({
      data: {
        engagementId: createReviewDto.engagementId,
        reviewerId: user.id,
        targetId: createReviewDto.targetId,
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
        structuredSignalsJson: parsedSignal,
        reviewerRole: reviewerRole,
      },
    });

    return review;
  }

  async getAllReview(userId: string, engagementId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("You don't have permission to access!");
    }

    const engagement = await this.prisma.engagement.findUnique({
      where: { id: engagementId },
    });

    if (!engagement) {
      throw new BadRequestException('Engagement not found');
    }

    if (!(engagement.state === EngagementState.CLOSED)) {
      throw new ConflictException('This engagement is not closed yet!');
    }

    const isBelongExpert = engagement.expertId === user.id;

    const isBelongCEO = engagement.clientId === user.id;

    const isBelongTechTeam = await this.prisma.techTeamProfile.findFirst({
      where: {
        userId: user.id,
        linkedProjectId: engagement.projectId,
      },
    });

    const isParty = isBelongExpert || isBelongCEO || isBelongTechTeam;

    if (!isParty && user.activeRole !== ActiveRole.ADMIN) {
      throw new ForbiddenException('Not a party to this engagement');
    }

    return await this.prisma.review.findMany({
      where: { engagementId: engagement.id },
    });
  }
}
