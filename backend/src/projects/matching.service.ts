import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FastapiClient, MatchingRequest } from '../elicitation/fastapi.client'; // Corrected import class name and type

// MatchingService manages the transient shortlist cache and handles scoring calculations.
// It triggers calculations on projects.state -> 'PUBLISHED' by executing
// the composite score algorithm on the FastAPI service.
@Injectable()
export class MatchingService {
  private shortlistCache = new Map<string, any[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient, // Corrected class name
  ) {}

  // Retrieves the calculated shortlist cards from cache.
  async getShortlist(projectId: string): Promise<any[] | null> {
    return this.shortlistCache.get(projectId) || null;
  }

  // Checks if an expert is in the cached shortlist for a project.
  async isExpertShortlisted(projectId: string, expertId: string): Promise<boolean> {
    const list = this.shortlistCache.get(projectId);
    if (!list) {
      return false;
    }
    return list.some((candidate) => candidate.expert_id === expertId);
  }

  // Triggers composite matching calculations against the FastAPI engine.
  async triggerMatching(projectId: string): Promise<void> {
    // 1. Fetch project footprint details from the database
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        state: true,
        tier: true,
        archetype: true,
        requiredSeamsJson: true,
        requiredDomainsJson: true,
      },
    });

    if (!project || project.state !== 'PUBLISHED') {
      return;
    }

    // 2. Query User directly to access related depths and seam claims.
    // Filter out the project owner and verify they have an ExpertProfile record.
    const expertUsers = await this.prisma.user.findMany({
      where: {
        id: {
          not: project.clientId, // Self-exclusion guard
        },
        expertProfile: {
          isNot: null, // Only fetch users who have completed expert setup
        },
      },
      include: {
        expertProfile: true, // Fetch engagementModel, stack tags, history
        expertDomainDepths: true, // Fetch domain depths from user relation
        expertSeamClaims: true, // Fetch seam claims from user relation
      },
    });

    if (expertUsers.length === 0) {
      this.shortlistCache.set(projectId, []);
      return;
    }

    // 3. Map Prisma schema relationships into the standard FastAPI matching contract payload
    const formattedExperts = expertUsers.map((expertUser) => {
      const profile = expertUser.expertProfile;
      return {
        expert_id: expertUser.id,
        engagement_model: profile?.engagementModel,
        stack_tags: profile?.stackTagsJson || [],
        archetype_history: profile?.archetypeHistoryJson || [],
        domain_depths: expertUser.expertDomainDepths.map((d) => ({
          domain_code: d.domainCode,
          depth_level: d.depthLevel,
          verification_tier: d.verificationTier,
        })),
        seam_claims: expertUser.expertSeamClaims.map((s) => ({
          seam_code: s.seamCode,
          verification_tier: s.verificationTier,
        })),
      };
    });

    // Cast the Prisma Json fields to compile safely as Record arrays [01]
    const payload: MatchingRequest = {
      required_seams_json: project.requiredSeamsJson as any,
      required_domains_json: project.requiredDomainsJson as any,
      expert_profiles: formattedExperts,
      project_archetype: project.archetype ?? undefined,
    };

    try {
      // 4. Hit FastAPI matching service using the public, type-safe method wrapper
      const response = await this.fastapiClient.matching(payload);

      // 5. Cache the scored and ranked shortlist card array
      this.shortlistCache.set(projectId, response);
    } catch (error) {
      // Safely extract the message depending on the type of error caught [1.1]
      const errorMessage = error instanceof Error ? error.message : String(error);

      throw new InternalServerErrorException(
        `Failed to calculate matches via AI Service: ${errorMessage}`,
      );
    }
  }
}
