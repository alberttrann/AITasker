import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { bidHasAcceptedTerms } from '../milestones/milestone-terms-lock';
import {
  acceptedOffer,
  currentOffer,
  deriveNegotiationState,
  isNegotiationEnvelope,
} from '../bids/bid-negotiation';

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
      deliverableStatement: true,
      paymentAmountVnd: true
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

      const engagements = await this.prisma.engagement.findMany({
        where,
        include: { project: PROJECT_SUMMARY_SELECT, capabilityBid: true },
        orderBy: { id: 'desc' },
      });
      return engagements.map((engagement) => this.withContractFlags(engagement));
    }

    // 2. EXPERT — engagements where they are the expert.
    if (user.activeRole === 'EXPERT') {
      const engagements = await this.prisma.engagement.findMany({
        where: { expertId: user.id },
        include: { 
          project: PROJECT_SUMMARY_SELECT, 
          capabilityBid: true,
          service: { select: { id: true, title: true, priceVnd: true } },
          client: { select: { id: true, fullName: true } },
          ...CURRENT_MILESTONE_INCLUDE 
        },
        orderBy: { id: 'desc' }, // Sort by newest IDs first
      });
      return engagements.map((engagement) => this.withContractFlags(engagement));
    }

    // 3. CEO — engagements where they are the client.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      const engagements = await this.prisma.engagement.findMany({
        where:   { clientId: user.id },
        include: { 
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
          service: { select: { id: true, title: true, priceVnd: true } },
          expert: { select: { fullName: true } },
          ...CURRENT_MILESTONE_INCLUDE 
        },
        orderBy: { id: 'desc' },
      });
      return engagements.map((engagement) => this.withContractFlags(engagement));
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

      const engagements = await this.prisma.engagement.findMany({
        where: { projectId: techProfile.linkedProjectId },
        include: {
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
          expert: true,
          ...CURRENT_MILESTONE_INCLUDE,
        },
        orderBy: { id: 'desc' },
      });
      return engagements.map((engagement) => this.withContractFlags(engagement, true));
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
        project: PROJECT_SUMMARY_SELECT,
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
      return this.withContractFlags(engagement);
    }

    // 3. EXPERT — must be the engagement's expert.
    if (user.activeRole === 'EXPERT') {
      if (engagement.expertId !== user.id) {
        throw new ForbiddenException('You are not a party to this engagement.');
      }
      return this.withContractFlags(engagement);
    }

    // 4. CLIENT roles — must be the client (CEO) or linked TECH_TEAM.
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      if (engagement.clientId !== user.id) {
        throw new ForbiddenException('You are not a party to this engagement.');
      }
      return this.withContractFlags(engagement);
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
      return this.withContractFlags(engagement, true);
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
      include: {
        capabilityBid: true,
        milestones: { select: { id: true } },
      },
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
    if (!bidHasAcceptedTerms(engagement.capabilityBid) || engagement.milestones.length === 0) {
      throw new UnprocessableEntityException({
        error: 'ACCEPTED_CONTRACT_REQUIRED',
        message: 'The bid must be accepted and its milestones finalized before NDA signing.',
      });
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

    // 6. Persist the signature, then derive CONNECTED from both stored timestamps.
    const ndaResult = await this.prisma.$transaction(async (tx) => {
      await tx.engagement.update({
        where: { id },
        data: { clientNdaAcceptedAt: new Date() },
      });
      const transition = await tx.engagement.updateMany({
        where: {
          id,
          state: 'PENDING',
          clientNdaAcceptedAt: { not: null },
          expertNdaAcceptedAt: { not: null },
        },
        data: { state: 'CONNECTED', connectedAt: new Date() },
      });
      return {
        engagement: await tx.engagement.findUnique({ where: { id } }),
        transitioned: transition.count === 1,
      };
    });

    if (ndaResult.transitioned) {
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
    return ndaResult.engagement;
  }

  private withContractFlags<T extends {
    capabilityBid?: { conditionalPricingJson: unknown; negotiatedPriceVnd?: bigint | null } | null;
    clientNdaAcceptedAt: Date | null;
    expertNdaAcceptedAt: Date | null;
  }>(engagement: T, restrictedTechnicalView = false) {
    const capabilityBid = engagement.capabilityBid;
    const envelope = capabilityBid && isNegotiationEnvelope(capabilityBid.conditionalPricingJson)
      ? capabilityBid.conditionalPricingJson
      : undefined;
    const accepted = envelope ? acceptedOffer(envelope) : undefined;
    const current = envelope ? currentOffer(envelope) : undefined;
    const negotiation = envelope ? deriveNegotiationState(envelope) : undefined;
    return {
      ...engagement,
      ...(capabilityBid
        ? {
            capabilityBid: {
              ...capabilityBid,
              conditionalPricingJson: restrictedTechnicalView
                ? undefined
                : capabilityBid.conditionalPricingJson,
              negotiatedPriceVnd: restrictedTechnicalView
                ? undefined
                : capabilityBid.negotiatedPriceVnd === null || capabilityBid.negotiatedPriceVnd === undefined
                  ? null
                  : Number(capabilityBid.negotiatedPriceVnd),
              acceptedOffer: restrictedTechnicalView ? undefined : accepted,
              currentOffer: restrictedTechnicalView ? undefined : current,
              negotiationState: negotiation?.negotiationState,
              nextActionBy: negotiation?.nextActionBy,
              termsLocked: Boolean(accepted),
              ndaComplete: Boolean(
                engagement.clientNdaAcceptedAt && engagement.expertNdaAcceptedAt,
              ),
              termsAcceptedAt: restrictedTechnicalView ? undefined : envelope?.termsAcceptedAt,
            },
          }
        : {}),
      termsLocked: bidHasAcceptedTerms(capabilityBid),
      ndaComplete: Boolean(
        engagement.clientNdaAcceptedAt && engagement.expertNdaAcceptedAt,
      ),
    };
  }

  // PUT /engagements/:id/connect — expert accepts connection + NDA.
  // Blueprint: docs/04-endpoints.md §0.11 L row 148.
  // Guards: state != PENDING → 422 · expert_nda_accepted_at already set → 409.
  // If both NDA timestamps are now non-null: state → CONNECTED.
  // Non-blocking: if expert has no linked bank account, returns prompt_bank_link: true.
  async acceptConnect(id: string, user: ActorUser) {
    // 1. Fetch engagement — no project include needed (expert check uses engagement.expertId).
    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
      include: {
        capabilityBid: true,
        milestones: { select: { id: true } },
      },
    });

    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    if (
      engagement.projectId &&
      (!bidHasAcceptedTerms(engagement.capabilityBid) || engagement.milestones.length === 0)
    ) {
      throw new UnprocessableEntityException({
        error: 'ACCEPTED_CONTRACT_REQUIRED',
        message: 'The bid must be accepted and its milestones finalized before NDA signing.',
      });
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

    // 5. Persist the signature, then derive CONNECTED from both stored timestamps.
    const ndaResult = await this.prisma.$transaction(async (tx) => {
      await tx.engagement.update({
        where: { id },
        data: { expertNdaAcceptedAt: new Date() },
      });
      const transition = await tx.engagement.updateMany({
        where: {
          id,
          state: 'PENDING',
          clientNdaAcceptedAt: { not: null },
          expertNdaAcceptedAt: { not: null },
        },
        data: { state: 'CONNECTED', connectedAt: new Date() },
      });
      return {
        engagement: await tx.engagement.findUnique({ where: { id } }),
        transitioned: transition.count === 1,
      };
    });

    // 6. Non-blocking bank-link prompt (docs/03 §BR-ART-07).
    //    If the expert has no linked bank account, surface a prompt so they
    //    know they'll need it before withdrawal.

    if (ndaResult.transitioned) {
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
      return { ...ndaResult.engagement, prompt_bank_link: true };
    }

    return ndaResult.engagement;
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
    const isLinkedTechTeam = await this.isLinkedTechTeam(
      engagement.projectId,
      user,
    );
    if (
      user.activeRole !== 'ADMIN' &&
      engagement.expertId !== user.id &&
      engagement.clientId !== user.id &&
      !isLinkedTechTeam
    ) {
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
        criterion: { select: { criterionText: true } },
        milestone: {
          select: {
            milestoneNumber: true,
            deliverableStatement: true,
            paymentAmountVnd: true,
          },
        },
        escrowAccount: { select: { status: true, amount: true } },
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

  private async isLinkedTechTeam(
    projectId: string | null,
    user: ActorUser,
  ): Promise<boolean> {
    if (
      !projectId ||
      user.activeRole !== 'CLIENT' ||
      user.clientSubtype !== 'TECH_TEAM'
    ) {
      return false;
    }
    const profile = await this.prisma.techTeamProfile.findUnique({
      where: { userId: user.id },
      select: { linkedProjectId: true },
    });
    return profile?.linkedProjectId === projectId;
  }
}
