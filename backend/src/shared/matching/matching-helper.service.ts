// Shared "find eligible experts, format for ai-service, call /llm/matching"
// logic. Two callers:
//   1. ElicitationService — precheckCandidateCount() during the Stage 5
//      quality gate, BEFORE any Project row exists.
//   2. ProjectsModule's MatchingService — triggerMatching() AFTER a Project
//      is published, for the real cached shortlist (unchanged responsibility,
//      now delegates the actual scoring call here instead of duplicating it).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FastapiClient, MatchResult } from '../../elicitation/fastapi.client';

@Injectable()
export class MatchingHelperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  /**
   * Queries all eligible experts, formats them for the ai-service /llm/matching
   * contract, and returns the scored+ranked result. Does NOT require an
   * existing Project row — required_seams_json/required_domains_json/archetype
   * are passed in directly, so this works equally for:
   *   - a real published Project (ProjectsModule's triggerMatching)
   *   - an in-memory synthesis result not yet persisted (E10's pre-check)
   */
  async scoreEligibleExperts(
    requiredSeamsJson:   unknown,
    requiredDomainsJson: unknown,
    archetype:           string | null,
    excludeUserId?:      string,
  ): Promise<MatchResult[]> {
    const expertUsers = await this.prisma.user.findMany({
      where: {
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        expertProfile: { isNot: null },
      },
      include: {
        expertProfile:      true,
        expertDomainDepths: true,
        expertSeamClaims:   true,
      },
    });

    if (expertUsers.length === 0) {
      return [];
    }

    const formattedExperts = expertUsers.map((expertUser) => {
      const profile = expertUser.expertProfile;
      return {
        expert_id:         expertUser.id,
        engagement_model:  profile?.engagementModel,
        stack_tags:        profile?.stackTagsJson || [],
        archetype_history: profile?.archetypeHistoryJson || [],
        domain_depths: expertUser.expertDomainDepths.map((d) => ({
          domain_code:       d.domainCode,
          depth_level:       d.depthLevel,
          verification_tier: d.verificationTier,
        })),
        seam_claims: expertUser.expertSeamClaims.map((s) => ({
          seam_code:         s.seamCode,
          verification_tier: s.verificationTier,
        })),
      };
    });

    return this.fastapiClient.matching({
      required_seams_json:   requiredSeamsJson as any,
      required_domains_json: requiredDomainsJson as any,
      expert_profiles:       formattedExperts,
      project_archetype:     archetype ?? undefined,
    });
  }
}