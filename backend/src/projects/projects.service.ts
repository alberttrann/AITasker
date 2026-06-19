import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MatchingService } from './matching.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
  ) {}

  /**
   * Retrieves basic project details (for authorized project members/shortlisted candidates).
   */
  async findProject(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
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
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Bypass structural rules for platform admin
    if (activeRole === 'ADMIN') {
      return this.mapProjectResponse(project);
    }

    // Guard: If not published, only the client creator or linked TECH_TEAM can view
    if (project.state !== 'PUBLISHED') {
      const isOwnerOrLinkedTech = await this.checkClientOwnership(
        project,
        userId,
        activeRole,
        clientSubtype,
      );
      if (!isOwnerOrLinkedTech) {
        throw new ForbiddenException('Access denied. This project spec is not yet published.');
      }
    }

    // General authorization check
    const isAuthorized = await this.isUserAuthorized(project, userId, activeRole, clientSubtype);
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not a member of this project.');
    }

    return this.mapProjectResponse(project);
  }

  /**
   * Retrieves public specification artifact_a_json.
   */
  async findProjectArtifactA(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        clientId: true,
        state: true,
        artifactAJson: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return { artifact_a_json: project.artifactAJson };
    }

    // Guard: State must be published for experts to access publicly
    if (project.state !== 'PUBLISHED') {
      const isOwnerOrLinkedTech = await this.checkClientOwnership(
        project,
        userId,
        activeRole,
        clientSubtype,
      );
      if (!isOwnerOrLinkedTech) {
        throw new ForbiddenException('Artifact A is only available on published projects.');
      }
    }

    // Check if client is the owner or expert has been shortlisted/matched
    const isAuthorized = await this.isUserAuthorized(project, userId, activeRole, clientSubtype);
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not matched with this project.');
    }

    return { artifact_a_json: project.artifactAJson };
  }

  /**
   * Internal mapper to produce pure, snake_case API payloads.
   */
  private mapProjectResponse(project: any) {
    return {
      id: project.id,
      state: project.state,
      archetype: project.archetype,
      tier: project.tier,
      artifact_a_json: project.artifactAJson,
    };
  }

  /**
   * Performs ownership and scoping validations for client entities.
   */
  private async checkClientOwnership(
    project: any,
    userId: string,
    activeRole: string,
    clientSubtype?: string,
  ): Promise<boolean> {
    if (activeRole !== 'CLIENT') return false;

    // A CEO can view if they are the direct owner
    if (clientSubtype === 'CEO' && project.clientId === userId) {
      return true;
    }

    // A Tech Team member can view if their profile scope matches this project ID
    if (clientSubtype === 'TECH_TEAM') {
      const techProfile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: userId },
      });
      if (techProfile && techProfile.linkedProjectId === project.id) {
        return true;
      }
    }

    return false;
  }

  /**
   * Master membership check.
   */
  private async isUserAuthorized(
    project: any,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ): Promise<boolean> {
    if (activeRole === 'CLIENT') {
      return this.checkClientOwnership(project, userId, activeRole, clientSubtype);
    }

    if (activeRole === 'EXPERT') {
      // 1. Check if the expert is already linked via an Engagement (Active, Bid pending, etc.)
      const engagement = await this.prisma.engagement.findFirst({
        where: {
          projectId: project.id,
          expertId: userId,
        },
      });

      if (engagement) {
        return true;
      }

      // 2. Check if the expert is part of the transient matching shortlist cache
      const isShortlisted = await this.matchingService.isExpertShortlisted(project.id, userId);
      if (isShortlisted) {
        return true;
      }
    }

    return false;
  }
}
