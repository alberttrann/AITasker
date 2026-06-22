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

type ActorUser = { id: string; activeRole: string; clientSubtype?: string };

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortlistService: ShortlistService,
  ) {}

  // POST /bids — expert initiates a bid on a published project.
  // Blueprint: docs/04-endpoints.md §0.11 L + docs/02-state-machines.md §3.
  // Atomic insert: engagement (PENDING) + capability_bids (DRAFT).
  // Expert must then call PUT /bids/:id with the 3 components to move to SUBMITTED.
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

    // 3. subscription gate for Tier 2-3 projects
    if (project.tier !== 'TIER_1' && expert.user.subscriptionExpertTier !== 'pro') {
      throw new ForbiddenException('Expert Pro subscription required for Tier 2-3 projects.');
    }

    // 4. self-exclusion: project owner cannot bid on their own project
    if (project.clientId === expertUserId) {
      throw new ForbiddenException('Project owner cannot bid on their own project.');
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
          state: 'DRAFT',
          techStatus: 'PENDING',
          ceoStatus: 'PENDING',
          versionNumber: 1,
        },
      });

      return { engagement, bid };
    });
  }

  // GET /bids/:id — view full bid detail.
  // Blueprint: docs/04-endpoints.md §0.11 L row 158. Allowed: TECH_TEAM (linked),
  // CEO (project owner), EXPERT (bid owner), ADMIN. No state filter.
  async findById(bidId: string, user: ActorUser) {
    // 1. fetch the bid row only (response stays minimal — no nested objects)
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException('Bid not found.');
    }

    // 2. fetch the engagement separately for the party check
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: bid.engagementId },
      select: { id: true, expertId: true, projectId: true },
    });
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

  private async isProjectOwner(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    return project?.clientId === userId;
  }

  // Both POST and PUT gate on Expert Pro for Tier 2-3 projects (docs/03 BR-BID-09).
  // POST reads the tier off the expert profile include; PUT uses this helper
  // because the engagement fetch doesn't carry the user row.
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
  // Blueprint: docs/04 §0.11 L row 159 + docs/02 §3 REVISION_REQUESTED → TECH_REVIEW loop.
  // In-place mutable row update; increments version_number.
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
      },
    });
  }
}
