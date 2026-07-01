import {
  Injectable, NotFoundException, ForbiddenException,
  ServiceUnavailableException, UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MatchingService } from './matching.service';
import { FastapiClient } from '../elicitation/fastapi.client';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
    private readonly fastapiClient: FastapiClient,   
  ) {}

  async findProject(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true, clientId: true, state: true,
        archetype: true, tier: true, artifactAJson: true,
        projectName: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return this.mapProjectResponse(project);
    }

    if (project.state !== 'PUBLISHED') {
      const isOwnerOrLinkedTech = await this.checkClientOwnership(
        project, userId, activeRole, clientSubtype,
      );
      if (!isOwnerOrLinkedTech) {
        throw new ForbiddenException('Access denied. This project spec is not yet published.');
      }
    }

    const isAuthorized = await this.isUserAuthorized(project, userId, activeRole, clientSubtype);
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not a member of this project.');
    }

    return this.mapProjectResponse(project);
  }

  async findProjectArtifactA(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, state: true, artifactAJson: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return { artifact_a_json: project.artifactAJson };
    }

    if (project.state !== 'PUBLISHED') {
      const isOwnerOrLinkedTech = await this.checkClientOwnership(
        project, userId, activeRole, clientSubtype,
      );
      if (!isOwnerOrLinkedTech) {
        throw new ForbiddenException('Artifact A is only available on published projects.');
      }
    }

    const isAuthorized = await this.isUserAuthorized(project, userId, activeRole, clientSubtype);
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not matched with this project.');
    }

    return { artifact_a_json: project.artifactAJson };
  }
  
  async findProjectArtifactB(
    projectId:     string,
    userId:        string,
    activeRole:    'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    // "requester.active_role = CLIENT/CEO → 403 permanent" — checked
    // FIRST, before even looking up the project. No CEO ever gets Artifact B.
    if (activeRole === 'CLIENT' && clientSubtype === 'CEO') {
      throw new ForbiddenException(
        'CEOs cannot access Artifact B — this is the technical deep-dive ' +
        'spec for matched experts and tech teams only.',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, artifactBJson: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return { artifact_b_json: project.artifactBJson };
    }

    let engagement: any;

    if (activeRole === 'EXPERT') {
      engagement = await this.prisma.engagement.findFirst({
        where: { projectId, expertId: userId },
        include: { capabilityBid: true },
      });
      if (!engagement) {
        throw new ForbiddenException('You are not engaged with this project.');
      }
    } else if (clientSubtype === 'TECH_TEAM') {
      const techProfile = await this.prisma.techTeamProfile.findUnique({ where: { userId } });
      if (!techProfile || techProfile.linkedProjectId !== projectId) {
        throw new ForbiddenException('You are not linked to this project.');
      }
      engagement = await this.prisma.engagement.findFirst({
        where: { projectId, state: { in: ['ACTIVE', 'CONNECTED'] } },
        include: { capabilityBid: true },
      });
      if (!engagement) {
        throw new ForbiddenException('No engagement on this project has progressed far enough yet.');
      }
    } else {
      throw new ForbiddenException('Access denied.');
    }

    const bidState = engagement.capabilityBid?.state ?? 'DRAFT';

    let guardResult;
    try {
      guardResult = await this.fastapiClient.checkArtifactBAccess(projectId, {
        engagement_state:    engagement.state,
        bid_state:           bidState,
        expert_nda_accepted: !!engagement.expertNdaAcceptedAt,
        ceo_nda_accepted:    !!engagement.clientNdaAcceptedAt,
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        throw new ForbiddenException(
          err.response.data?.detail ?? 'Artifact B is not yet accessible for this engagement.',
        );
      }
      throw new ServiceUnavailableException('Could not verify Artifact B access — please try again.');
    }

    return { artifact_b_json: project.artifactBJson };
  }

  async getMatchingShortlist(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, state: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (project.clientId !== userId) {
      throw new ForbiddenException('Only the project owner may view the shortlist.');
    }
    if (project.state !== 'PUBLISHED') {
      throw new UnprocessableEntityException('Project is not yet published.');
    }

    const shortlist = await this.matchingService.getShortlist(projectId);
    // strip composite_score before returning 
    // numeric scores must never reach the frontend, labels/colors only.
    return await this.matchingService.mapShortlistForFrontend(shortlist ?? []);
  }

  private mapProjectResponse(project: any) {
    return {
      id: project.id,
      state: project.state,
      archetype: project.archetype,
      tier: project.tier,
      artifact_a_json: project.artifactAJson,
      projectName: project.projectName,
    };
  }

  private async checkClientOwnership(
    project: any, userId: string, activeRole: string, clientSubtype?: string,
  ): Promise<boolean> {
    if (activeRole !== 'CLIENT') return false;

    if (clientSubtype === 'CEO' && project.clientId === userId) {
      return true;
    }

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

  private async isUserAuthorized(
    project: any, userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ): Promise<boolean> {
    if (activeRole === 'CLIENT') {
      return this.checkClientOwnership(project, userId, activeRole, clientSubtype);
    }

    // any EXPERT may view Artifact A on a published project —
    // no prior engagement or shortlist required. This method only runs
    // once the caller has already cleared the PUBLISHED-state check
    // above it, so reaching here as a non-owning EXPERT already implies
    // the project is published.
    if (activeRole === 'EXPERT') {
      return true;
    }
 
    return false;
  }

  /**
   * @param slim When true, returns only lightweight scalar fields — no JSONBs.
   *             Cuts payload ~80% for list/card views.
   *             Full record (artifactAJson, etc.) should be fetched via GET /projects/:id.
   */
  async getProjects(
    userId: string,
    activeRole: string,
    clientSubtype?: string,
    slim = false,
  ) {
    const slimSelect = slim
      ? {
          id: true,
          projectName: true,
          state: true,
          archetype: true,
          tier: true,
          selfTechnical: true,
          createdAt: true,
        }
      : undefined;

    const fullInclude = slim
      ? undefined
      : {
          _count: {
            select: { engagements: { where: { type: 'PROJECT_BASED' } } },
          },
        };

    const queryOptions = slim
      ? { select: slimSelect }
      : { include: fullInclude };

    if (activeRole === 'CLIENT' && clientSubtype === 'CEO') {
      if (slim) {
        return this.prisma.project.findMany({
          where: { clientId: userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, projectName: true, state: true,
            archetype: true, tier: true, selfTechnical: true, createdAt: true,
          },
        });
      }
      return this.prisma.project.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { engagements: { where: { type: 'PROJECT_BASED' } } } } },
      });
    }
    if (activeRole === 'CLIENT' && clientSubtype === 'TECH_TEAM') {
      const tech = await this.prisma.techTeamProfile.findUnique({ where: { userId } });
      if (!tech?.linkedProjectId) return [];
      if (slim) {
        return this.prisma.project.findMany({
          where: { id: tech.linkedProjectId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, projectName: true, state: true,
            archetype: true, tier: true, selfTechnical: true, createdAt: true,
          },
        });
      }
      return this.prisma.project.findMany({
        where: { id: tech.linkedProjectId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { engagements: { where: { type: 'PROJECT_BASED' } } } } },
      });
    }
    return [];
  }

  async updateProjectName(projectId: string, userId: string, projectName: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== userId) throw new ForbiddenException('Only the owner can rename the project');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { projectName },
      select: { id: true, projectName: true } // Trả về gọn nhẹ cho FE
    });
  }
}