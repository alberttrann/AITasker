import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';

type ActorUser = { id: string; activeRole: string; clientSubtype?: string };

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
      const projects = await this.prisma.project.findMany({
        where: { clientId: user.id },
        select: { id: true },
      });

      const projectIds = projects.map((p) => p.id);

      return this.prisma.engagement.findMany({
        where: { projectId: { in: projectIds } },
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
}
