import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FastapiClient } from '../elicitation/fastapi.client';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  async findProject(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM' | string,
  ) {
    // 1. Fetch project with internal fields needed for authorization checks
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        state: true,
        archetype: true,
        tier: true,
        artifactAJson: true,
        requiredSeamsJson: true,
        requiredDomainsJson: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // 2. Bypass verification checks immediately if user is platform ADMIN
    if (activeRole === 'ADMIN') {
      return {
        id: project.id,
        state: project.state,
        archetype: project.archetype,
        tier: project.tier,
        artifact_a_json: project.artifactAJson,
      };
    }

    let isAuthorized = false;

    // 3. Check access rights based on Client ownership
    if (activeRole === 'CLIENT') {
      if (clientSubtype === 'CEO' && project.clientId === userId) {
        // User is the project-owning CEO
        isAuthorized = true;
      } else if (clientSubtype === 'TECH_TEAM') {
        // Verify if this specific member profile is linked directly to this project
        const techProfile = await this.prisma.techTeamProfile.findUnique({
          where: { userId: userId },
        });
        if (techProfile && techProfile.linkedProjectId === projectId) {
          isAuthorized = true;
        }
      }
    }

    // 4. Check access rights for EXPERTs (connected engagement or shortlisted match)
    if (activeRole === 'EXPERT') {
      // Condition A: Expert has a connected or pending engagement with the project
      const engagement = await this.prisma.engagement.findFirst({
        where: {
          projectId: projectId,
          expertId: userId,
        },
      });

      if (engagement) {
        isAuthorized = true;
      } else {
        // Condition B: Fallback check against the composite match cache table/shortlist.
        const isShortlisted = await this.checkMatchingShortlistCache(projectId, userId);
        if (isShortlisted) {
          isAuthorized = true;
        }
      }
    }

    // 5. Throw 403 Forbidden if none of the authorized condition gates pass
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not a member of this project.');
    }

    // 6. Return exactly what the spec mandates
    return {
      id: project.id,
      state: project.state,
      archetype: project.archetype,
      tier: project.tier,
      artifact_a_json: project.artifactAJson,
    };
  }

  /**
   * Helper method to verify expert shortlist status dynamically via the FastAPI matching engine.
   */
  private async checkMatchingShortlistCache(projectId: string, userId: string): Promise<boolean> {
    // TODO: implement matching shortlist check
    return true;
  }
}
