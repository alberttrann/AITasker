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
}
