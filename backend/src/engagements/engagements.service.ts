import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

type ActorUser = { id: string; activeRole: string; clientSubtype: string | null };

// Shared project select shape for all engagement list queries.
const PROJECT_SUMMARY_SELECT = {
  select: {
    id: true,
    projectName: true,
    state: true,
    archetype: true,
    tier: true,
    createdAt: true,
  },
} as const;


const CURRENT_MILESTONE_INCLUDE = {
  milestones: {
    orderBy: { milestoneNumber: 'asc' },
    select: {
      id: true,
      milestoneNumber: true,
      state: true,
      deliverableStatement: true
    }
  }
} as any;

@Injectable()
export class EngagementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

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

      return this.prisma.engagement.findMany({
        where,
        include: { project: PROJECT_SUMMARY_SELECT },
        orderBy: { id: 'desc' },
      });
    }

    // 2. EXPERT — engagements where they are the expert.
    if (user.activeRole === 'EXPERT') {
      return this.prisma.engagement.findMany({
        where: { expertId: user.id },
        include: { 
          project: PROJECT_SUMMARY_SELECT, 
          capabilityBid: true,
          service: { select: { id: true, title: true } },
          client: { select: { id: true, fullName: true } },
          ...CURRENT_MILESTONE_INCLUDE 
        },
        orderBy: { id: 'desc' }, // Sort by newest IDs first
      });
    }

    // 3. CEO — engagements where they are the client.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      return this.prisma.engagement.findMany({
        where:   { clientId: user.id },
        include: { 
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
          service: { select: { id: true, title: true } },
          expert: { select: { fullName: true } },
          ...CURRENT_MILESTONE_INCLUDE 
        },
        orderBy: { id: 'desc' },
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
        include: {
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
          expert: true,
        },
        orderBy: { id: 'desc' },
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
        service: true,
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

    // 4. CLIENT roles — must be the client (CEO) or linked TECH_TEAM.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      if (engagement.clientId !== user.id) {
        throw new ForbiddenException('You are not a party to this engagement.');
      }
      return engagement;
    }

    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'TECH_TEAM') {
      if (!engagement.projectId) {
        throw new ForbiddenException('You are not a party to this engagement.');
      }
      const techProfile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: user.id },
        select: { linkedProjectId: true },
      });
      if (techProfile?.linkedProjectId !== engagement.projectId) {
        throw new ForbiddenException('You are not a party to this engagement.');
      }
      return engagement;
    }

    throw new ForbiddenException('You are not a party to this engagement.');
  }

  // PUT /engagements/:id/nda — CEO accepts NDA for a project-based engagement.
  // Blueprint: docs/04-endpoints.md §0.11 L row 147.
  // Guards: state != PENDING → 422 · client_nda_accepted_at already set → 409.
  // If both NDA timestamps are now non-null: state → CONNECTED, connected_at = now().
  async acceptNda(id: string, user: ActorUser) {
    // 1. Fetch engagement fields needed for guards + update.
    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 2. NDA flow only applies to PROJECT_BASED engagements.
    if (!engagement.projectId) {
      throw new UnprocessableEntityException(
        'NDA acceptance only applies to project-based engagements.',
      );
    }

    // 3. Verify user is the CEO who owns this engagement.
    if (user.activeRole !== 'CLIENT' || user.clientSubtype !== 'CEO') {
      throw new ForbiddenException('Only the CEO can accept the NDA.');
    }
    if (engagement.clientId !== user.id) {
      throw new ForbiddenException('You are not the CEO of this engagement.');
    }

    // 4. State guard — must be PENDING.
    if (engagement.state !== 'PENDING') {
      throw new UnprocessableEntityException(
        `Engagement is in state ${engagement.state}; NDA acceptance requires PENDING.`,
      );
    }

    // 5. Idempotency guard — client already accepted.
    if (engagement.clientNdaAcceptedAt !== null) {
      throw new ConflictException('NDA has already been accepted by the client.');
    }

    // 6. Set client_nda_accepted_at. If expert has also accepted, transition to CONNECTED.
    const bothAccepted = engagement.expertNdaAcceptedAt !== null;

    if (bothAccepted) {
      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.expertId,
        event: 'notification:generic',
        payload: {
          type: 'system',
          title: 'Project Connected!',
          body: 'The CEO has signed the NDA. You now have access to Artifact B (Technical Specs).',
          link: `/expert/projects/${engagement.projectId}`,
        },
      });
    }

    return this.prisma.engagement.update({
      where: { id },
      data: {
        clientNdaAcceptedAt: new Date(),
        ...(bothAccepted && {
          state: 'CONNECTED',
          connectedAt: new Date(),
        }),
      },
    });
  }

  // PUT /engagements/:id/connect — expert accepts connection + NDA.
  // Blueprint: docs/04-endpoints.md §0.11 L row 148.
  // Guards: state != PENDING → 422 · expert_nda_accepted_at already set → 409.
  // If both NDA timestamps are now non-null: state → CONNECTED.
  // Non-blocking: if expert has no linked bank account, returns prompt_bank_link: true.
  async acceptConnect(id: string, user: ActorUser) {
    // 1. Fetch engagement — no project include needed (expert check uses engagement.expertId).
    const engagement = await this.prisma.engagement.findUnique({ where: { id } });

    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 2. Verify user is the expert of this engagement.
    if (user.activeRole !== 'EXPERT') {
      throw new ForbiddenException('Only the expert can accept the connection.');
    }
    if (engagement.expertId !== user.id) {
      throw new ForbiddenException('You are not the expert of this engagement.');
    }

    // 3. State guard — must be PENDING.
    if (engagement.state !== 'PENDING') {
      throw new UnprocessableEntityException(
        `Engagement is in state ${engagement.state}; connection requires PENDING.`,
      );
    }

    // 4. Idempotency guard — expert already accepted.
    if (engagement.expertNdaAcceptedAt !== null) {
      throw new ConflictException('Connection has already been accepted by the expert.');
    }

    // 5. Set expert_nda_accepted_at. If client has also accepted, transition to CONNECTED.
    const bothAccepted = engagement.clientNdaAcceptedAt !== null;

    const updated = await this.prisma.engagement.update({
      where: { id },
      data: {
        expertNdaAcceptedAt: new Date(),
        ...(bothAccepted && {
          state: 'CONNECTED',
          connectedAt: new Date(),
        }),
      },
    });

    // 6. Non-blocking bank-link prompt (docs/03 §BR-ART-07).
    //    If the expert has no linked bank account, surface a prompt so they
    //    know they'll need it before withdrawal.

    if (bothAccepted) {
      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.clientId,
        event: 'notification:generic',
        payload: {
          type: 'system',
          title: 'Expert Connected!',
          body: 'The expert has signed the NDA and joined the project workspace.',
          link: `/ceo/projects/${engagement.projectId}`,
        },
      });
    }
    const expert = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { sepayBankAccountXid: true },
    });

    if (!expert?.sepayBankAccountXid) {
      return { ...updated, prompt_bank_link: true };
    }

    return updated;
  }

  // PUT /engagements/:id/decline — expert declines a connection request.
  // Blueprint: docs/04-endpoints.md §0.11 L row 149.
  // Guard: state != PENDING → 422.
  // Sets state → DECLINED. CEO notification is a future Socket.io event.
  async decline(id: string, user: ActorUser) {
    // 1. Fetch engagement.
    const engagement = await this.prisma.engagement.findUnique({ where: { id } });

    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 2. Verify user is the expert of this engagement.
    if (user.activeRole !== 'EXPERT') {
      throw new ForbiddenException('Only the expert can decline a connection.');
    }
    if (engagement.expertId !== user.id) {
      throw new ForbiddenException('You are not the expert of this engagement.');
    }

    // 3. State guard — must be PENDING.
    if (engagement.state !== 'PENDING') {
      throw new UnprocessableEntityException(
        `Engagement is in state ${engagement.state}; declining requires PENDING.`,
      );
    }

    // 4. Set state → DECLINED. CEO notification fires via Socket.io in a
    //    future sprint (docs §W row 285 engagement:state-changed event).
    return this.prisma.engagement.update({
      where: { id },
      data: { state: 'DECLINED' },
    });
  }

  async getEngagementMilestones(engagementId: string, user: ActorUser) {
    const engagement = await this.prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    // Basic party check
    if (user.activeRole !== 'ADMIN' && engagement.expertId !== user.id && engagement.clientId !== user.id) {
      throw new ForbiddenException('Not a party to this engagement.');
    }
    return this.prisma.milestone.findMany({
      where: { engagementId },
      orderBy: { milestoneNumber: 'asc' },
      include: { acceptanceCriteria: true, dodItems: true },
    });
  }

  async getEngagementSubmissions(engagementId: string, user: ActorUser) {
    const engagement = await this.prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    if (user.activeRole !== 'ADMIN' && engagement.expertId !== user.id && engagement.clientId !== user.id) {
      throw new ForbiddenException('Not a party to this engagement.');
    }
    return this.prisma.milestoneSubmission.findMany({
      where: { milestone: { engagementId } },
      orderBy: { id: 'desc' },
      include: { milestone: { select: { milestoneNumber: true, deliverableStatement: true } } },
    });
  }

  async getEngagementBid(engagementId: string, user: ActorUser) {
    const engagement = await this.prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    if (user.activeRole !== 'ADMIN' && engagement.expertId !== user.id && engagement.clientId !== user.id) {
      throw new ForbiddenException('Not a party to this engagement.');
    }
    const bid = await this.prisma.capabilityBid.findFirst({
      where: { engagementId },
      orderBy: { id: 'asc' },
    });
    if (!bid) throw new NotFoundException('No bid found for this engagement.');
    return bid;
  }

  async getEngagementDisputes(engagementId: string, user: ActorUser) {
    const engagement = await this.prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    if (user.activeRole !== 'ADMIN' && engagement.expertId !== user.id && engagement.clientId !== user.id) {
      throw new ForbiddenException('Not a party to this engagement.');
    }
    return this.prisma.dispute.findMany({
      where: { milestone: { engagementId } },
      orderBy: { filedAt: 'desc' },
      include: {
        milestone: { select: { milestoneNumber: true, deliverableStatement: true } },
      },
    });
  }

  async cancelEngagement(engagementId: string, user: ActorUser) {
    const engagement = await this.prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!engagement) throw new NotFoundException('Engagement not found.');
    if (user.activeRole !== 'ADMIN' && engagement.expertId !== user.id && engagement.clientId !== user.id) {
      throw new ForbiddenException('Not a party to this engagement.');
    }
    const fundedMilestones = await this.prisma.milestone.count({
      where: { engagementId, state: { in: ['FUNDED', 'SUBMITTED', 'IN_REVISION'] } },
    });
    if (fundedMilestones > 0) {
      throw new UnprocessableEntityException(
        `Cannot cancel engagement with ${fundedMilestones} active milestone(s). Resolve them first.`,
      );
    }
    return this.prisma.engagement.update({
      where: { id: engagementId },
      data: { state: 'CANCELLED' as any },
    });
  }
}
