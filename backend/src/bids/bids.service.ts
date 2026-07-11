import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ShortlistService } from './shortlist.service';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { TechReviewDto } from './dto/tech-review.dto';
import { CeoDecisionDto } from './dto/ceo-decision.dto';
import { CounterOfferDto } from './dto/counter-offer.dto';
import { EventEmitter2 } from '@nestjs/event-emitter'; 

type ActorUser = { id: string; activeRole: string; clientSubtype?: string };

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortlistService: ShortlistService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // POST /bids — expert initiates a bid on a published project.
  async create(expertUserId: string, dto: CreateBidDto) {
    // 1. expert profile + owner subscription tier in one query
    const expert = await this.prisma.expertProfile.findUnique({
      where: { userId: expertUserId },
      include: {
        user: { select: { subscriptionExpertTier: true } },
      },
    });
    if (!expert) {
      throw new NotFoundException('Expert profile not found.');
    }

    // 2. project must exist and be published
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, clientId: true, state: true, tier: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    if (project.state !== 'PUBLISHED') {
      throw new UnprocessableEntityException(
        `Project is in state ${project.state}; bidding requires PUBLISHED.`,
      );
    }

    // 3. self-exclusion: project owner cannot bid on their own project
    if (project.clientId === expertUserId) {
      throw new ForbiddenException('Project owner cannot bid on their own project.');
    }

    // 4. subscription gate for Tier 2-3 projects
    if (project.tier !== 'TIER_1' && expert.user.subscriptionExpertTier !== 'pro') {
      throw new ForbiddenException('Expert Pro subscription required for Tier 2-3 projects.');
    }

    // 5. expert must appear in the shortlist (cached, computed via FastAPI /llm/matching)
    const isShortlisted = await this.shortlistService.isExpertShortlisted(project.id, expertUserId);
    if (!isShortlisted) {
      throw new ForbiddenException('Expert is not in this project shortlist.');
    }

    // 6. no existing PROJECT_BASED engagement for (project, expert)
    const existing = await this.prisma.engagement.findFirst({
      where: { projectId: project.id, expertId: expertUserId, type: 'PROJECT_BASED' },
    });
    if (existing) {
      throw new ConflictException('An engagement already exists for this expert on this project.');
    }

    // 7. atomic insert: engagement + bid
    return this.prisma.$transaction(async (tx) => {
      const engagement = await tx.engagement.create({
        data: {
          projectId: project.id,
          expertId: expertUserId,
          clientId: project.clientId,
          serviceId: null,
          type: 'PROJECT_BASED',
          state: 'PENDING',
        },
      });

      const bid = await tx.capabilityBid.create({
        data: {
          engagementId: engagement.id,
          footprintAlignmentJson: dto.footprint_alignment_json,
          approachSummary: dto.approach_summary,
          conditionalPricingJson: dto.conditional_pricing_json,
          state: 'SUBMITTED',
          techStatus: 'PENDING',
          ceoStatus: 'PENDING',
          versionNumber: 1,
        } as any,
      });
      // Mark the expert's invitation as ACCEPTED now that they've submitted a bid.
      // Uses updateMany so it silently no-ops if the expert bid without an invitation.
      await tx.invitation.updateMany({
        where: { projectId: project.id, expertId: expertUserId, status: 'PENDING' },
        data:  { status: 'ACCEPTED', respondedAt: new Date() },
      });

      this.eventEmitter.emit('socket.broadcast', {
        userId: project.clientId,
        event: 'notification:generic',
        payload: {
          type:  'bid_update',
          title: 'New Expert Bid!',
          body:  'An expert has submitted a capability bid for your project.',
          link:  `/ceo/projects/${project.id}`,
        },
      });

      // Notify all linked Tech Team members 
      const techTeamMembers = await tx.techTeamProfile.findMany({
        where:  { linkedProjectId: project.id },
        select: { userId: true },
      });
      for (const member of techTeamMembers) {
        this.eventEmitter.emit('socket.broadcast', {
          userId: member.userId,
          event:  'notification:generic',
          payload: {
            type:  'bid_update',
            title: 'New Bid Awaiting Review',
            body:  'An expert has submitted a capability bid. Your technical review is required.',
            link:  `/tech-team/projects/${project.id}`,
          },
        });
      }

      return { engagement, bid };
    });
  }

  // GET /bids/:id — view full bid detail.
  // CEO (project owner), EXPERT (bid owner), ADMIN. No state filter.
  async findById(bidId: string, user: ActorUser) {
    // 1. fetch the bid row with engagement and expert included
    const bid = await this.prisma.capabilityBid.findUnique({ 
      where: { id: bidId },
      include: {
        engagement: {
          include: { expert: { select: { fullName: true } } }
        }
      }
    });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. use the included engagement for the party check
    const engagement = bid.engagement;
    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 3. party check
    const isAdmin = user.activeRole === 'ADMIN';
    const isExpert = user.activeRole === 'EXPERT' && engagement.expertId === user.id;
    const isCeo =
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'CEO' &&
      (await this.isProjectOwner(engagement.projectId, user.id));
    const isTechTeam =
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'TECH_TEAM' &&
      (await this.isLinkedTechTeam(engagement.projectId, user.id));

    if (!isAdmin && !isExpert && !isCeo && !isTechTeam) {
      throw new ForbiddenException('You are not a party to this bid.');
    }

    return bid;
  }

  async findAll(user: { id: string; activeRole: string; clientSubtype?: string }, projectId?: string) {
    if (user.activeRole === 'EXPERT') {
      // Expert sees all their own bids (filters by traversing the nested engagement relation)
      return this.prisma.capabilityBid.findMany({
        where: { engagement: { expertId: user.id } }, 
        include: {
          engagement: {
            include: { project: { select: { id: true, projectName: true, state: true } } },
          },
        },
        orderBy: { id: 'desc' }, 
      });
    }

    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      // CEO sees bids for their project(s)
      const where: any = {
        engagement: { project: { clientId: user.id } },
      };
      if (projectId) where.engagement.projectId = projectId;

      return this.prisma.capabilityBid.findMany({
        where,
        include: {
          engagement: {
            include: { project: { select: { id: true, projectName: true } } },
          },
        },
        orderBy: { id: 'desc' }, 
      });
    }

    if (user.activeRole === 'ADMIN') {
      return this.prisma.capabilityBid.findMany({
        where: projectId ? { engagement: { projectId } } : undefined,
        orderBy: { id: 'desc' }, 
        take: 100,
      });
    }

    return [];
  }

  private async isProjectOwner(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    return project?.clientId === userId;
  }

  private async isExpertPro(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpertTier: true },
    });
    return user?.subscriptionExpertTier === 'pro';
  }

  private async isLinkedTechTeam(projectId: string, userId: string): Promise<boolean> {
    const tech = await this.prisma.techTeamProfile.findUnique({
      where: { userId },
      select: { linkedProjectId: true },
    });
    return tech?.linkedProjectId === projectId;
  }

  // PUT /bids/:id — expert revises a bid after TECH_TEAM requested changes.
  async update(bidId: string, expertUserId: string, dto: UpdateBidDto) {
    // 1. bid must exist
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. expert must own the bid (engagement.expertId === userId)
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: bid.engagementId },
      select: { expertId: true, project: { select: { tier: true } } },
    });
    if (engagement?.expertId !== expertUserId) {
      // 404 if engagement vanished (broken FK — engagementId is non-nullable
      // on capability_bids, so this should never happen, but if it does we
      // surface as 403 to avoid leaking FK state to a non-owner).
      throw new ForbiddenException('You do not own this bid.');
    }

    // 3a. subscription gate (PUT is [Pro-E] for Tier 2-3, matching POST)
    const expertIsPro = await this.isExpertPro(expertUserId);
    if (engagement.project.tier !== 'TIER_1' && !expertIsPro) {
      throw new ForbiddenException(
        'Expert Pro subscription required to revise bids on Tier 2-3 projects.',
      );
    }

    // 3b. revisions only allowed when TECH_TEAM explicitly asked for one
    if (bid.techStatus !== 'REVISION_REQUESTED') {
      throw new UnprocessableEntityException(
        `Bid is in tech_status ${bid.techStatus}; revisions require REVISION_REQUESTED.`,
      );
    }

    // 4. in-place update: refresh components, reset tech_status, loop state back to TECH_REVIEW, bump version
    return this.prisma.capabilityBid.update({
      where: { id: bidId },
      data: {
        footprintAlignmentJson: dto.footprint_alignment_json,
        approachSummary: dto.approach_summary,
        conditionalPricingJson: dto.conditional_pricing_json,
        techStatus: 'PENDING',
        state: 'TECH_REVIEW', // per state machine §3 loop-back
        versionNumber: { increment: 1 },
      } as any,
    });
  }

  // PUT /bids/:id/tech-review — TECH_TEAM approves or requests revision.
  async techReview(bidId: string, user: ActorUser, dto: TechReviewDto) {
    // 1. bid must exist
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. fetch engagement for projectId (needed for the link check)
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: bid.engagementId },
      select: { id: true, projectId: true, expertId: true }, 
    });
    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 3. state check — must be reviewable (not SELECTED or DECLINED)
    if (['SELECTED', 'DECLINED'].includes(bid.state)) {
      throw new UnprocessableEntityException(`Bid is in state ${bid.state}; cannot review.`);
    }

    // 4. identity + link check
    if (user.activeRole !== 'CLIENT' || user.clientSubtype !== 'TECH_TEAM') {
      throw new ForbiddenException('Only TECH_TEAM can review bids.');
    }
    const tech = await this.prisma.techTeamProfile.findUnique({
      where: { userId: user.id },
      select: { linkedProjectId: true },
    });
    if (tech?.linkedProjectId !== engagement.projectId) {
      throw new ForbiddenException('TECH_TEAM is not linked to this project.');
    }

    // 5. update bid. zod already validated tech_feedback presence.
    const data: { techStatus: string; techFeedback?: string } = { techStatus: dto.action };
    if (dto.action === 'REVISION_REQUESTED') {
      data.techFeedback = dto.tech_feedback;
    }
    if (dto.action === 'REVISION_REQUESTED') {
      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.expertId,
        event: 'bid:updated', // Matches the specific frontend socket listener
        payload: { engagement_id: engagement.id, state: 'REVISION_REQUESTED' }
      });
    } else if (dto.action === 'APPROVED') {
      // Notify CEO that tech review passed
      const project = await this.prisma.project.findUnique({ where: { id: engagement.projectId } });
      if (project) {
        this.eventEmitter.emit('socket.broadcast', {
          userId: project.clientId,
          event: 'notification:generic',
          payload: {
            type: 'system',
            title: 'Tech Review Passed',
            body: 'A bid has passed technical review and awaits your final decision.',
            link: `/ceo/projects/${project.id}`
          }
        });
      }
    }
    return this.prisma.capabilityBid.update({ where: { id: bidId }, data });
  }

  // PUT /bids/:id/ceo-decision — CEO picks the winner (or rejects).
  async ceoDecision(bidId: string, user: ActorUser, dto: CeoDecisionDto) {
    // 1. bid must exist
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. fetch engagement with project (for owner check)
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: bid.engagementId },
      include: { project: { select: { id: true, clientId: true } } },
    });
    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 3. identity + ownership check (CEO owns the project)
    if (user.activeRole !== 'CLIENT' || user.clientSubtype !== 'CEO') {
      throw new ForbiddenException('Only CEO can decide bids.');
    }
    if (engagement.project.clientId !== user.id) {
      throw new ForbiddenException('You do not own this project.');
    }

    // 4. tech_status gate (docs/03 BR-BID-04 / BR-BID-10)
    if (bid.techStatus !== 'APPROVED') {
      throw new UnprocessableEntityException('TECH_REVIEW_INCOMPLETE');
    }

    // 5. ceo_status already set → 409
    if (bid.ceoStatus !== 'PENDING') {
      throw new ConflictException(`Bid is already in ceo_status ${bid.ceoStatus}.`);
    }

    // 6. atomic: this bid + (if APPROVED) cascade DECLINE to all siblings
    return this.prisma.$transaction(async (tx) => {
      const updatedBid = await tx.capabilityBid.update({
        where: { id: bidId },
        data: {
          ceoStatus: dto.decision,
          state: dto.decision === 'APPROVED' ? 'SELECTED' : 'DECLINED',
        },
      });

      if (dto.decision === 'APPROVED') {
        // Cascade: all sibling bids for the same project → DECLINED.
        // (Literal doc reading: "all other bids for project → DECLINED".)
        // The ceoStatus='PENDING' filter is defensive — avoids re-declining
        // already-decided bids in case of any pre-existing state.
        await tx.capabilityBid.updateMany({
          where: {
            id: { not: bidId },
            ceoStatus: 'PENDING',
            engagement: {
              projectId: engagement.project.id,
              type: 'PROJECT_BASED',
            },
          },
          data: { ceoStatus: 'DECLINED', state: 'DECLINED' },
        });
      }
      this.eventEmitter.emit('socket.broadcast', {
        userId: engagement.expertId,
        event: 'bid:updated',
        payload: { 
          engagement_id: engagement.id, 
          state: dto.decision === 'APPROVED' ? 'SELECTED' : 'DECLINED' 
        }
      });
      return updatedBid;
    });
  }

  // PUT /bids/:id/counter-offer — CEO proposes a counter-price.
  async counterOffer(bidId: string, user: ActorUser, dto: CounterOfferDto) {
    // 1. bid must exist
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. fetch engagement with project (for owner check)
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: bid.engagementId },
      include: { project: { select: { id: true, clientId: true } } },
    });
    if (!engagement) {
      throw new NotFoundException('Engagement not found.');
    }

    // 3. identity + ownership check
    if (user.activeRole !== 'CLIENT' || user.clientSubtype !== 'CEO') {
      throw new ForbiddenException('Only CEO can submit a counter-offer.');
    }
    if (engagement.project.clientId !== user.id) {
      throw new ForbiddenException('You do not own this project.');
    }

    // 4. tech_status gate
    if (bid.techStatus !== 'APPROVED') {
      throw new UnprocessableEntityException('TECH_REVIEW_INCOMPLETE');
    }

    // 5. counter-offer already set → 409
    if (bid.negotiatedPriceVnd !== null) {
      throw new ConflictException('COUNTER_OFFER_ALREADY_SET');
    }

    // 6. set the counter-offer price. Immutable after this write.
    return this.prisma.capabilityBid.update({
      where: { id: bidId },
      data: { negotiatedPriceVnd: dto.negotiated_price_vnd },
    });
  }

  async withdraw(bidId: string, expertUserId: string) {
    // Include the engagement relation to verify ownership (CapabilityBid has no direct expertId)
    const bid = await this.prisma.capabilityBid.findUnique({
      where: { id: bidId },
      include: {
        engagement: {
          select: { expertId: true },
        },
      },
    });

    if (!bid) throw new NotFoundException('Bid not found.');

    // Check ownership via the fetched relation
    if (bid.engagement.expertId !== expertUserId) {
      throw new ForbiddenException('You do not own this bid.');
    }

    if (bid.state !== 'SUBMITTED') {
      throw new UnprocessableEntityException(
        `Cannot withdraw a bid in state '${bid.state}'. Only SUBMITTED bids can be withdrawn.`,
      );
    }

    // Invalidate the bid
    await this.prisma.capabilityBid.update({
      where: { id: bidId },
      data: { state: 'WITHDRAWN' as any },
    });

    return { withdrawn: true, bidId };
  }
}