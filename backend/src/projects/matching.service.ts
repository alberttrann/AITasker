import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/prisma.service';
import { MatchingHelperService } from '../shared/matching/matching-helper.service';
import { MatchResult } from '../elicitation/fastapi.client';

// ProjectPublishedEvent shape
interface ProjectPublishedEvent {
  projectId:  string;
  candidates: MatchResult[];
}

@Injectable()
export class MatchingService {
  private shortlistCache = new Map<string, MatchResult[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingHelper: MatchingHelperService,
  ) {}

  // listens for ElicitationService's 'project.published' event and
  // seeds the cache DIRECTLY from the already-fetched candidate list — no
  // second ai-service /llm/matching call for the same project.
  @OnEvent('project.published')
  handleProjectPublished(payload: ProjectPublishedEvent): void {
    this.shortlistCache.set(payload.projectId, payload.candidates);
  }

  async getShortlist(projectId: string): Promise<MatchResult[] | null> {
    if (!this.shortlistCache.has(projectId)) {
      await this.triggerMatching(projectId);
    }
    return this.shortlistCache.get(projectId) || null;
  }

  async isExpertShortlisted(projectId: string, expertId: string): Promise<boolean> {
    if (!this.shortlistCache.has(projectId)) {
      await this.triggerMatching(projectId);
    }
    const list = this.shortlistCache.get(projectId);
    if (!list) return false;
    return list.some((candidate) => candidate.expert_id === expertId);
  }

  // Kept as a manual/admin re-trigger capability (e.g. "re-run matching
  // after new experts onboard") — the AUTOMATIC post-publish path now goes
  // through handleProjectPublished() above instead of this method.
  async triggerMatching(projectId: string): Promise<void> {
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
      const response = await this.matchingHelper.scoreEligibleExperts(
        project.requiredSeamsJson,
        project.requiredDomainsJson,
        project.archetype,
        project.clientId,
      );
      this.shortlistCache.set(projectId, response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Failed to calculate matches via AI Service: ${errorMessage}`,
      );
    }
  }

  // strips composite_score before returning to the frontend 
  // numeric scores must never be exposed, labels/colors only.
  mapShortlistForFrontend(results: MatchResult[]): Array<{
    expert_id: string;
    strength_label: string;
    gap_map: MatchResult['gap_map'];
  }> {
    return results.map((r) => ({
      expert_id:      r.expert_id,
      strength_label: r.strength_label,
      gap_map:        r.gap_map,
    }));
  }
}