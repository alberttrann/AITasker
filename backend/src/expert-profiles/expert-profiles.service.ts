import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { UpsertDomainDepthDto } from './dto/upsert-domain-depth.dto';
import { UpsertSeamClaimDto } from './dto/upsert-seam-claim.dto';

@Injectable()
export class ExpertProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const profile = await this.prisma.expertProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            subscriptionExpertTier: true,
            subExpertExpiresAt: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Expert profile not registered on this account');
    }

    const domainDepths = await this.prisma.expertDomainDepth.findMany({
      where: { expertId: userId },
    });

    const seamClaims = await this.prisma.expertSeamClaim.findMany({
      where: { expertId: userId },
    });

    return { profile, domainDepths, seamClaims };
  }

  async updateMyProfile(userId: string, dto: UpdateExpertProfileDto) {
    const data: Prisma.ExpertProfileUpdateInput = {};

    if (dto.engagementModel) data.engagementModel = dto.engagementModel;
    if (dto.archetypeHistoryJson) {
      data.archetypeHistoryJson = dto.archetypeHistoryJson.map((item) => ({
        archetypeCode: item.archetypeCode,
        tier: item.tier,
        selfDeclared: item.selfDeclared,
      }));
    }
    if (dto.stackTagsJson) data.stackTagsJson = dto.stackTagsJson;

    const exists = await this.prisma.expertProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });

    if (!exists) {
      throw new NotFoundException('Expert profile not found on this account.');
    }

    return this.prisma.expertProfile.update({
      where: { userId },
      data,
    });
  }

  async createDomainDepth(userId: string, dto: UpsertDomainDepthDto) {
    try {
      return this.prisma.expertDomainDepth.create({
        data: {
          expertId: userId,
          domainCode: dto.domainCode,
          depthLevel: dto.depthLevel,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A depth claim for this domain already exists. Use PUT to update.',
        );
      }
      throw error;
    }
  }

  async updateDomainDepth(userId: string, id: string, depthLevel: string) {
    const exist = await this.prisma.expertDomainDepth.findUnique({
      where: { id },
      select: { expertId: true },
    });

    if (!exist) throw new NotFoundException('Domain depth not found.');

    if (exist.expertId !== userId) {
      throw new ForbiddenException('You are not the owner of this domain depth');
    }

    return this.prisma.expertDomainDepth.update({
      where: { id },
      data: { depthLevel },
    });
  }

  async createSeamClaim(userId: string, dto: UpsertSeamClaimDto) {
    try {
      return await this.prisma.expertSeamClaim.create({
        data: {
          expertId: userId,
          seamCode: dto.seamCode,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A seam claim for this seam already exists. Use PUT to update.',
        );
      }
      throw error;
    }
  }
}
