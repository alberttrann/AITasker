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

/**
 * §0.11.I, B, J — Expert Profile Service
 *
 * Owns all read/write logic for expert_profiles, expert_domain_depths, and
 * expert_seam_claims tables. Consumed by:
 * - expert-profiles.controller (GET/PUT /expert-profiles/me)
 * - domain-depths.controller   (POST/PUT /expert-domain-depths)
 * - seam-claims.controller     (POST /expert-seam-claims)
 *
 * Exported via expert-profiles.module so projects/matching.service.ts can
 * later query expert data for the FastAPI /llm/matching payload.
 */
@Injectable()
export class ExpertProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * §0.11.I — GET /expert-profiles/me
   *
   * R: expert_profiles, expert_domain_depths, expert_seam_claims.
   *
   * Returns 404 if the expert has no profile row (shouldn't happen in
   * practice — registration creates the row per §0.11.A).
   */
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

  /**
   * §0.11.I — PUT /expert-profiles/me
   *
   * Partial update of expert_profiles. Only fields present in the DTO are
   * written (empty body → no fields updated).
   *
   * Strict update: 404 if profile missing. Upsert rejected per §0.11.A
   * (registration creates the row atomically).
   *
   * archetypeHistoryJson is mapped from class instances to plain objects to
   * satisfy Prisma's InputJsonValue type constraint.
   */
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

  /**
   * §0.11.I — POST /expert-domain-depths
   *
   * Creates a new expert_domain_depths row at verification_tier = 'CLAIMED'
   * (default per schema).
   *
   * - 409 on duplicate (expert_id, domain_code) per §0.11.I (caught via
   *   Prisma P2002 unique constraint violation on @@unique([expertId,
   *   domainCode])).
   * - 422 on invalid domain_code is handled at the DTO/ValidationPipe layer
   *   (DTO @IsEnum(['A','B','C','D','E','F']) + errorHttpStatusCode: 422).
   */
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
      // P2002 = unique constraint violation on @@unique([expertId, domainCode])
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A depth claim for this domain already exists. Use PUT to update.',
        );
      }
      throw error;
    }
  }

  /**
   * §0.11.I — PUT /expert-domain-depths/:id
   *
   * Updates depth_level only on an existing claim. domainCode is in the DTO
   * for symmetry with POST but the service ignores it — it's part of the
   * (expert_id, domain_code) natural key per the schema's @@unique constraint
   * and is immutable here.
   *
   * Per §0.11.I: caller must be the owner of the depth claim (403 otherwise).
   *
   * - 404 if row missing.
   * - 403 if caller is not the owner.
   */
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

  /**
   * §0.11.I — POST /expert-seam-claims
   *
   * Creates a new expert_seam_claims row with schema defaults:
   * - verification_tier = 'CLAIMED'
   * - submission_count  = 0
   * - locked_until      = NULL
   *
   * Per BR-VER-01: every seam claim starts at Tier 1 (CLAIMED) on
   * self-declaration; Tier 1 confidence weight = 0.20 per §0.4.
   *
   * - 409 on duplicate (expert_id, seam_code) per §0.11.I (P2002).
   * - 422 on invalid seam_code is handled at the DTO/ValidationPipe layer
   *   (DTO @IsEnum on the 10 SEAM_CODE values).
   */
  async createSeamClaim(userId: string, dto: UpsertSeamClaimDto) {
    try {
      return await this.prisma.expertSeamClaim.create({
        data: {
          expertId: userId,
          seamCode: dto.seamCode,
          // verification_tier, submission_count, locked_until all use schema defaults:
          //   verification_tier = 'CLAIMED'
          //   submission_count  = 0
          //   locked_until      = NULL
        },
      });
    } catch (error) {
      // P2002 = unique constraint violation on @@unique([expertId, seamCode])
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'A seam claim for this seam already exists. Use PUT to update.',
        );
      }
      throw error;
    }
  }
}
