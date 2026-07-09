import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
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
    if (dto.bio !== undefined) data.bio = dto.bio;
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
    return this.prisma.expertDomainDepth.upsert({
      where: {
        expertId_domainCode: {
          expertId: userId,
          domainCode: dto.domainCode,
        },
      },
      update: {
        depthLevel: dto.depthLevel,
      },
      create: {
        expertId: userId,
        domainCode: dto.domainCode,
        depthLevel: dto.depthLevel,
      },
    });
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
    return await this.prisma.expertSeamClaim.upsert({
      where: {
        expertId_seamCode: {
          expertId: userId,
          seamCode: dto.seamCode,
        },
      },
      update: {}, // No fields to update for a seam claim right now, just ensure it exists
      create: {
        expertId: userId,
        seamCode: dto.seamCode,
      },
    });
  }

  async syncDomainDepths(userId: string, domains: UpsertDomainDepthDto[]) {
    return this.prisma.$transaction(async (tx) => {
      const incomingCodes = domains.map(d => d.domainCode);
      await tx.expertDomainDepth.deleteMany({
        where: { expertId: userId, domainCode: { notIn: incomingCodes } },
      });

      for (const d of domains) {
        await tx.expertDomainDepth.upsert({
          where: { expertId_domainCode: { expertId: userId, domainCode: d.domainCode } },
          update: { depthLevel: d.depthLevel },
          create: { expertId: userId, domainCode: d.domainCode, depthLevel: d.depthLevel },
        });
      }
      return { success: true };
    });
  }

  async syncSeamClaims(userId: string, seams: string[]) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Tìm các seam mà user đang muốn xoá
      const seamsToDelete = await tx.expertSeamClaim.findMany({
        where: { expertId: userId, seamCode: { notIn: seams } },
      });

      // 2. Chặn xoá nếu đã có lịch sử submit (để chống việc bypass anti-spam lockout 5 lần)
      const invalidDeletions = seamsToDelete.filter(s => s.submissionCount > 0);
      if (invalidDeletions.length > 0) {
        const lockedSeams = invalidDeletions.map(s => s.seamCode).join(', ');
        throw new BadRequestException(
          `Cannot remove seams with verification history (${lockedSeams}). This preserves platform verification integrity.`
        );
      }

      await tx.expertSeamClaim.deleteMany({
        where: { expertId: userId, seamCode: { notIn: seams } },
      });

      for (const code of seams) {
        await tx.expertSeamClaim.upsert({
          where: { expertId_seamCode: { expertId: userId, seamCode: code } },
          update: {}, 
          create: { expertId: userId, seamCode: code },
        });
      }
      return { success: true };
    });
  }
}
