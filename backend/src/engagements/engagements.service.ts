import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';

type ActorUser = { id: string; activeRole: string; clientSubtype: string | null };

@Injectable()
export class EngagementsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /engagements — list own engagements (or all for ADMIN).
  // Blueprint: docs/04-endpoints.md §0.11 L row 145.
  async findAll(
    user: ActorUser,
    filters?: { state?: string; type?: string; connectedAt?: string },
  ) {
    // 1. ADMIN — all engagements, optionally filtered by state / type / date.
    if (user.activeRole === 'ADMIN') {
      const where: Record<string, unknown> = {};

      if (filters?.state) {
        where.state = filters.state;
      }

      if (filters?.type) {
        where.type = filters.type;
      }

      if (filters?.connectedAt) {
        where.connectedAt = { gte: new Date(filters.connectedAt) };
      }

      return this.prisma.engagement.findMany({ where });
    }

    // 2. EXPERT — engagements where they are the expert.
    if (user.activeRole === 'EXPERT') {
      return this.prisma.engagement.findMany({
        where: { expertId: user.id },
      });
    }

    // 3. CEO — engagements on projects they own.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      return this.prisma.engagement.findMany({
        where: { project: { clientId: user.id } },
      });
    }

    // 4. TECH_TEAM — engagements on the single project they are linked to.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'TECH_TEAM') {
      const techProfile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: user.id },
        select: { linkedProjectId: true },
      });

      if (!techProfile?.linkedProjectId) {
        return [];
      }

      return this.prisma.engagement.findMany({
        where: { projectId: techProfile.linkedProjectId },
      });
    }

    // Unreachable — class-level guard prevents unmatched roles.
    throw new ForbiddenException('Access denied.');
  }

  // GET /engagements/:id — full engagement detail.
  // Blueprint: docs/04-endpoints.md §0.11 L row 146.
  // Guard: must be a party to the engagement OR ADMIN.
  // R tables: engagements, capability_bids, milestones.
  async findById(id: string, user: ActorUser) {
    // 1. Fetch engagement with included relations listed in the doc R column.
    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
      include: {
        capabilityBid: true,
        milestones: true,
      },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 2. ADMIN sees everything — skip party check.
    if (user.activeRole === 'ADMIN') {
      return engagement;
    }

    // 3. EXPERT — must be the engagement's expert.
    if (user.activeRole === 'EXPERT') {
      if (engagement.expertId !== user.id) {
        throw new ForbiddenException('You are not a party to this engagement.');
      }
      return engagement;
    }

    // 4. CLIENT roles — must own the project (CEO) or be linked to it (TECH_TEAM).
    //    Only applies to PROJECT_BASED engagements (projectId is non-null).
    //    KNOWN LIMITATION: SERVICE_PURCHASE / TECH_DISCOVERY engagements have
    //    projectId = null and the Engagement model has no clientId column.
    //    A CEO who purchased a service will receive 403 here. The engagement
    //    ID is a non-guessable UUID returned in the purchase response, so
    //    practical exposure is minimal.
    if (engagement.projectId) {
      if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
        const project = await this.prisma.project.findUnique({
          where: { id: engagement.projectId },
          select: { clientId: true },
        });

        if (project?.clientId === user.id) {
          return engagement;
        }
      }

      if (user.activeRole === 'CLIENT' && user.clientSubtype === 'TECH_TEAM') {
        const techProfile = await this.prisma.techTeamProfile.findUnique({
          where: { userId: user.id },
          select: { linkedProjectId: true },
        });

        if (techProfile?.linkedProjectId === engagement.projectId) {
          return engagement;
        }
      }
    }

    throw new ForbiddenException('You are not a party to this engagement.');
  }
}
