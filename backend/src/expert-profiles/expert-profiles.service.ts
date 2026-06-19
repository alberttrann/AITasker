import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
}
