import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FastapiClient, MatchingRequest } from '../elicitation/fastapi.client';

interface ShortlistCacheEntry {
  expertIds: Set<string>;
  fetchedAt: Date;
}

type ProjectForPayload = NonNullable<Awaited<ReturnType<ShortlistService['fetchProject']>>>;
type ExpertForPayload = Awaited<ReturnType<ShortlistService['fetchExpertPool']>>[number];

@Injectable()
export class ShortlistService {
  private readonly cache = new Map<string, ShortlistCacheEntry>();
  // Refresh every 5 min so newly-claimed seams/domains become bid-eligible without a pod restart.
  private static readonly TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  async isExpertShortlisted(projectId: string, expertId: string): Promise<boolean> {
    const cached = this.cache.get(projectId);
    // Stale-while-refresh: serve from cache if fresh, otherwise recompute.
    if (cached && Date.now() - cached.fetchedAt.getTime() < ShortlistService.TTL_MS) {
      return cached.expertIds.has(expertId);
    }
    await this.refresh(projectId);
    return this.cache.get(projectId)?.expertIds.has(expertId) ?? false;
  }

  private async refresh(projectId: string): Promise<void> {
    const project = await this.fetchProject(projectId);
    if (!project) {
      // Cache an empty entry so a 404'd project doesn't re-hit the DB for the TTL window.
      this.cache.set(projectId, { expertIds: new Set(), fetchedAt: new Date() });
      return;
    }

    const experts = await this.fetchExpertPool(project.clientId);
    const payload = this.buildPayload(project, experts);

    try {
      const results = await this.fastapiClient.matching(payload);
      this.cache.set(projectId, {
        expertIds: new Set(results.map((r) => r.expert_id)),
        fetchedAt: new Date(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Shortlist verification failed: ${msg}`);
    }
  }

  private async fetchProject(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        clientId: true,
        archetype: true,
        requiredSeamsJson: true,
        requiredDomainsJson: true,
      },
    });
  }

  private async fetchExpertPool(clientId: string) {
    return this.prisma.user.findMany({
      // Self-exclusion: drop the project owner. Admin-suspended (isActive=false) experts excluded too.
      where: {
        id: { not: clientId },
        isActive: true,
        expertProfile: { isNot: null },
      },
      include: {
        expertProfile: true,
        expertDomainDepths: true,
        expertSeamClaims: true,
      },
    });
  }

  private buildPayload(project: ProjectForPayload, experts: ExpertForPayload[]): MatchingRequest {
    // Shape matches the FastAPI /llm/matching contract (docs/04 §0.11 V, row 269).
    // The `as any` casts on the JSONB columns are unavoidable — Prisma's JsonValue
    // union is wider than what the FastAPI client expects.
    return {
      required_seams_json: project.requiredSeamsJson as any,
      required_domains_json: project.requiredDomainsJson as any,
      project_archetype: project.archetype ?? undefined,
      expert_profiles: experts.map((u) => this.formatExpert(u)),
    };
  }

  private formatExpert(u: ExpertForPayload) {
    const profile = u.expertProfile;
    return {
      expert_id: u.id,
      engagement_model: profile?.engagementModel,
      stack_tags: profile?.stackTagsJson ?? [],
      archetype_history: profile?.archetypeHistoryJson ?? [],
      domain_depths: u.expertDomainDepths.map((d) => ({
        domain_code: d.domainCode,
        depth_level: d.depthLevel,
        verification_tier: d.verificationTier,
      })),
      seam_claims: u.expertSeamClaims.map((s) => ({
        seam_code: s.seamCode,
        verification_tier: s.verificationTier,
      })),
    };
  }
}
