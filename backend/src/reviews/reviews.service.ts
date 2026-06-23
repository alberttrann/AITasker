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
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException("You don't have permission to access!");
    }

    const engagement = await this.prisma.engagement.findUnique({
      where: {
        id: createReviewDto.engagementId,
      },
    });

    if (!engagement) {
      throw new BadRequestException('Engagement not found');
    }

    if (!(engagement.state === EngagementState.CLOSED)) {
      throw new ConflictException('This engagement is not closed yet!');
    }

    /*
        Reviews service with 3 pipelines:
        1. CEO reviews Expert
        2. Expert reviews CEO
        3. Tech team reviews Expert
    */

    // Deciding the review role
    // Reviewer roles pipelines decision
    const userActiveRole = user.activeRole;

    const reviewerRole =
      userActiveRole === ActiveRole.CLIENT
        ? user.clientSubtype === ClientSubType.CEO
          ? ReviewerRole.CEO
          : ReviewerRole.TECH_TEAM
        : ReviewerRole.EXPERT;

    // Check to see if this user has made an review to the target before
    const isExistedReview = await this.prisma.review.findFirst({
      where: {
        engagementId: createReviewDto.engagementId,
        reviewerId: user.id,
      },
    });

    if (isExistedReview) {
      throw new ConflictException('You have made this review before!');
    }

    let parsedSignal; // signal for json parsing of structuredSignalsJson if the json parse is successfully

    switch (reviewerRole) {
      /*
        Inside each case, need to check whether they're belong to that party or not!
        1. CEO belong to that project
        2. Tech team with the link profile match with the link project id
        3. Expert belong to the engagements

        We also need to validate that the targetId sent through the DTO is correctly align with the id inside the engagement or not -> This make CEO/TECH_TEAM/EXPERT writing review with the exact person
       */

      case ReviewerRole.CEO:
        const isBelongProject = await this.prisma.project.findFirst({
          where: {
            id: engagement.projectId,
            clientId: user.id,
          },
        });

        if (!isBelongProject) {
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

        // Checking if the stucturedSignalJson is missing or not
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

        const project = await this.prisma.project.findUnique({
          where: {
            id: engagement.projectId,
          },
        });

        if (!project) {
          throw new BadRequestException('Project not found for this engagement');
        }

        if (createReviewDto.targetId !== project.clientId) {
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
}
