import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';

@Injectable()
export class ExpertProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // R: expert_profiles, expert_domain_depths, expert_seam_claims
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
    // the update payload — Prisma.ExpertProfileUpdateInput expects
    // JSONB fields as InputJsonValue | null, not unknown
    const data: Prisma.ExpertProfileUpdateInput = {};

    if (dto.engagementModel) data.engagementModel = dto.engagementModel;
    // `archetype_history_json` Format: `[{archetype_code, tier, self_declared: true}]` - 01-er-plan.md
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
}
