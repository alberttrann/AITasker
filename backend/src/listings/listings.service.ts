import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ListServicesFilterDto } from './dto/create-listing.dto';

// Actor shape passed from the controller. Matches the bids/engagements pattern.
type Actor = { id: string; activeRole: string };

// Hard cap on rows returned by GET /services browse.
// Doc §0.11 K row 133 is silent on pagination. We cap to prevent unbounded
// queries if the marketplace grows. Adjust here if needed.
const SERVICE_BROWSE_LIMIT = 50;

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /services — browse marketplace.
  // Blueprint: docs/04-endpoints.md §0.11 K row 133.
  // - Actor: any authenticated user.
  // - Gate: [None].
  // - R: services (only state = PUBLISHED rows).
  // - Filters: service_type, domains, seams, minPriceVnd/maxPriceVnd (all optional, AND'd).
  async list(filter: ListServicesFilterDto) {
    const where: any = {
      state: 'PUBLISHED', // doc row 133: "Returns state = PUBLISHED listings."
    };

    if (filter.service_type) {
      where.serviceType = filter.service_type;
    }

    if (filter.minPriceVnd !== undefined || filter.maxPriceVnd !== undefined) {
      where.priceVnd = {};
      if (filter.minPriceVnd !== undefined) {
        where.priceVnd.gte = filter.minPriceVnd;
      }
      if (filter.maxPriceVnd !== undefined) {
        where.priceVnd.lte = filter.maxPriceVnd;
      }
    }

    if (filter.domains && filter.domains.length > 0) {
      // JSONB array contains filter. Literal Prisma `array_contains` semantics:
      // service.domains_json must contain ALL requested codes (Postgres @>).
      // For a single code, this is the same as "contains this code".
      where.domainsJson = { array_contains: filter.domains };
    }

    if (filter.seams && filter.seams.length > 0) {
      where.seamsJson = { array_contains: filter.seams };
    }

    // NOTE: docs imply newest-first browse, but `services` has no `created_at`
    // EDIT THIS IF NEW CHANGES COME TO SCHEMA!
    // column (verified in backend/prisma/schema.prisma + migrations/005_services.sql).
    // UUID v4 PK is random, so `orderBy: { id: 'desc' }` would NOT be chronological.
    // Returning insertion-order (no orderBy) is the honest choice; flag in PR.
    return this.prisma.service.findMany({
      where,
      take: SERVICE_BROWSE_LIMIT,
    });
  }

  // GET /services/:id - single listing detail.
  // Blueprint: docs/04-endpoints.md §0.11 K row 134.
  // - Actor: any authenticated user.
  // - Gate: [None].
  // - R: services, reviews (aggregates).
  // - Guard: state != PUBLISHED AND not owner/admin → 404 (strict semantics;
  //   the doc says 404, not 403, so non-published rows are indistinguishable
  //   from missing rows to non-owners).
  async findOne(id: string, actor: Actor) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        expert: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    const isOwner = service.expertId === actor.id;
    const isAdmin = actor.activeRole === 'ADMIN';
    if (service.state !== 'PUBLISHED' && !isOwner && !isAdmin) {
      // 404 not 403 — non-published rows are hidden from non-owners. Same as
      // a missing row. Per doc row 134 and project 404-strict semantics.
      throw new NotFoundException('Service not found.');
    }

    // Reputation aggregates for the expert who owns this service.
    // Per docs/03 §15 BR-REV-06: AVG(rating), COUNT(DISTINCT engagement_id).
    // `reviews.targetId` = the user being reviewed = the expert seller.
    const aggregates = await this.prisma.review.aggregate({
      where: { targetId: service.expertId },
      _avg: { rating: true },
      _count: { engagementId: true },
    });

    return {
      ...service,
      reputation: {
        average_rating: aggregates._avg.rating,
        review_count: aggregates._count.engagementId,
      },
    };
  }
}
