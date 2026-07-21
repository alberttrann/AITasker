import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { MatchingHelperService } from '../shared/matching/matching-helper.service';
import { MatchResult } from '../elicitation/fastapi.client';

interface ProjectPublishedEvent {
  projectId: string;
  candidates: MatchResult[];
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingHelper: MatchingHelperService,
  ) {}

  // Event handler

  /**
   * Seeded at project publish time by ElicitationService's 'project.published' event.
   * Persists the candidate list that was already fetched during Stage 5 synthesis —
   * no second AI call needed. Uses upsert so re-publishing (edge case) is safe.
   */
  @OnEvent('project.published')
  async handleProjectPublished(payload: ProjectPublishedEvent): Promise<void> {
    await this.persistCache(payload.projectId, payload.candidates, 'AUTO');
  }

  // Public read API

  /**
   * Returns the cached MatchResult[] for a project.
   * Cache miss: triggers AI matching, persists result, then returns it.
   * Never returns null — always returns an array (may be empty on AI failure).
   */
  async getShortlist(projectId: string): Promise<MatchResult[]> {
    const cached = await this.readCache(projectId);
    if (cached !== null) return cached;

    // Cache miss — project was published before this feature was deployed,
    // or the row was manually deleted. Re-score now.
    await this.triggerMatching(projectId, 'AUTO');
    return (await this.readCache(projectId)) ?? [];
  }

  /**
   * Checks whether a specific expert appears in a project's shortlist.
   * Triggers matching on cache miss, same as getShortlist().
   */
  async isExpertShortlisted(projectId: string, expertId: string): Promise<boolean> {
    const list = await this.getShortlist(projectId);
    return list.some((r) => r.expert_id === expertId);
  }

  /**
   * Force-refreshes the shortlist: evicts the current DB row and re-runs AI scoring.
   * Called by MatchingController when the CEO hits ?refresh=true.
   * Writes source='FORCE_REFRESH' so you can audit manual re-scores.
   */
  async forceRefresh(projectId: string): Promise<void> {
    await this.evictCache(projectId);
    await this.triggerMatching(projectId, 'FORCE_REFRESH');
  }

  // Frontend mapping

  /**
   * Strips composite_score before returning to the frontend.
   * Numeric scores are never exposed — strength labels and gap colors only.
   * Also joins user contact info (fullName, email, phone) for each expert.
   */
  async mapShortlistForFrontend(results: MatchResult[], projectId: string) {
    if (!results || results.length === 0) return [];

    const expertIds = results.map((r) => r.expert_id);
    
    // Fetch users and existing invitations in parallel
    const [users, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: expertIds } },
        select: { id: true, fullName: true, email: true, phone: true },
      }),
      this.prisma.invitation.findMany({
        where: { projectId, expertId: { in: expertIds } },
        select: { expertId: true, status: true }
      })
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const inviteMap = new Map(invitations.map((i) => [i.expertId, i.status]));

    return results.map((r) => {
      const inviteStatus = inviteMap.get(r.expert_id);
      return {
        expert_id:      r.expert_id,
        strength_label: r.strength_label,
        gap_map:        r.gap_map,
        contact_info:   userMap.get(r.expert_id) ?? null,
        // Tell FE exactly what state the invite is in
        invitation_status: inviteStatus ?? 'NONE', 
      };
    });
  }

  // Private helpers

  /**
   * Reads the cached MatchResult[] from the DB.
   * Returns null on cache miss (no row exists yet).
   */
  private async readCache(projectId: string): Promise<MatchResult[] | null> {
    const row = await this.prisma.projectShortlistCache.findUnique({
      where: { projectId },
      select: { resultsJson: true },
    });

    if (!row) return null;

    // Prisma returns Json as unknown — cast to MatchResult[]
    const parsed = row.resultsJson as unknown as MatchResult[];
    return Array.isArray(parsed) ? parsed : [];
  }

  /**
   * Upserts the cache row for a project. Creates on first publish, updates on re-score.
   */
  private async persistCache(
    projectId: string,
    results: MatchResult[],
    source: 'AUTO' | 'FORCE_REFRESH',
  ): Promise<void> {
    await this.prisma.projectShortlistCache.upsert({
      where: { projectId },
      create: {
        projectId,
        resultsJson: results as any,
        generatedAt: new Date(),
        source,
      },
      update: {
        resultsJson: results as any,
        generatedAt: new Date(),
        source,
      },
    });
  }

  /**
   * Deletes the cache row for a project so the next read triggers a re-score.
   * Used by forceRefresh() before calling triggerMatching().
   */
  private async evictCache(projectId: string): Promise<void> {
    await this.prisma.projectShortlistCache.deleteMany({
      where: { projectId },
    });
  }

  /**
   * Calls the AI service to score eligible experts and writes the result to the DB.
   * Used for both cache-miss auto-fills and CEO-triggered force refreshes.
   */
  private async triggerMatching(
    projectId: string,
    source: 'AUTO' | 'FORCE_REFRESH',
  ): Promise<void> {
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

    try {
      const results = await this.matchingHelper.scoreEligibleExperts(
        project.requiredSeamsJson,
        project.requiredDomainsJson,
        project.archetype,
        project.clientId,
      );
      await this.persistCache(projectId, results, source);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(`Failed to calculate matches via AI Service: ${msg}`);
    }
  }
}
