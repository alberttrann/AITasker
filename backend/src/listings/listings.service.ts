import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateListingDto, ListServicesFilterDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FastapiClient } from '../elicitation/fastapi.client';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { generateVaNumber } from '@shared/ledger/va-generator';

// Actor shape passed from the controller. Matches the bids/engagements pattern.
type Actor = { id: string; activeRole: string };

// Buyer shape for purchase — needs clientSubtype for CEO gate.
// Shape comes from JwtStrategy.validate(): { id, email, activeRole, clientSubtype }.
type Buyer = { id: string; activeRole: string; clientSubtype?: string };

// Hard cap on rows returned by GET /services browse.
// Doc §0.11 K row 133 is silent on pagination. We cap to prevent unbounded
// queries if the marketplace grows. Adjust here if needed.
const SERVICE_BROWSE_LIMIT = 50;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
  ) {}

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

    if (filter.serviceType) {
      where.serviceType = filter.serviceType;
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
    // column (verified in backend/prisma/schema.prisma + migrations/005_services.sql).
    // UUID v4 PK is random, so `orderBy: { id: 'desc' }` would NOT be chronological.
    // Returning insertion-order (no orderBy) is the honest choice; flag in PR.
    const services = await this.prisma.service.findMany({
      where,
      take: SERVICE_BROWSE_LIMIT,
    });
    // Prisma BigInt → string: JSON.stringify cannot serialize BigInt.
    // Convert priceVnd to prevent 500 on every response.
    return services.map((s) => ({
      ...s,
      priceVnd: s.priceVnd.toString(),
    }));
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
      priceVnd: service.priceVnd.toString(),
      reputation: {
        average_rating: aggregates._avg.rating,
        review_count: aggregates._count.engagementId,
      },
    };
  }

  // POST /services — expert creates a listing at state: DRAFT.
  // Blueprint: docs/04-endpoints.md §0.11 K row 135.
  // - Actor: EXPERT.
  // - Gate: active Expert Pro subscription (docs/03 §BR-SUB-04 requires it for AI-generated listings).
  // - W: services.
  // - AI path: when dto.useAiGenerator=true, check subscription tier, then call
  //   FastAPI /llm/service-generate BEFORE INSERT to fill title/description/priceVnd.
  async create(expertUserId: string, dto: CreateListingDto) {
    let title = dto.title;
    let description = dto.description;
    let priceVnd: bigint | null = dto.priceVnd !== undefined ? BigInt(dto.priceVnd) : null;

    if (dto.useAiGenerator) {
      // Docs/03 §BR-SUB-04: Expert Pro required for AI-generated listings.
      const expert = await this.prisma.user.findUnique({
        where: { id: expertUserId },
        select: {
          subscriptionExpertTier: true,
          subExpertExpiresAt: true,
        },
      });
      if (
        !expert ||
        expert.subscriptionExpertTier === 'free' ||
        (expert.subExpertExpiresAt && expert.subExpertExpiresAt < new Date())
      ) {
        throw new BadRequestException(
          'Expert Pro subscription required for AI-generated service listings.',
        );
      }

      // DTO guarantees capabilities + targetUseCases non-empty (@ValidateIf).
      // Explicit guards replace non-null assertions.
      if (!dto.capabilities || dto.capabilities.length === 0) {
        throw new BadRequestException('capabilities is required when useAiGenerator=true.');
      }
      if (!dto.targetUseCases || dto.targetUseCases.length === 0) {
        throw new BadRequestException('targetUseCases is required when useAiGenerator=true.');
      }
      const ai = await this.fastapiClient.serviceGenerate({
        expert_capabilities: dto.capabilities,
        target_use_cases: dto.targetUseCases,
      });
      // FastAPI response shape: { title, description, scope, timeline, suggested_price_vnd }.
      // `services` table has only a single `description` TEXT column — no `timeline` column.
      // We pick `description` (user-facing) over `scope` (internal-ish) for the DB write.
      // If expert provided overrides, use them; otherwise use AI output.
      title = dto.title ?? ai.title;
      description = dto.description ?? ai.description;
      if (priceVnd === null) {
        priceVnd = BigInt(ai.suggested_price_vnd);
      }
    }

    // Explicit guards replace non-null assertions. Both fields are guaranteed
    // by their respective paths (manual DTO requirement or AI fallback).
    if (!title) {
      throw new BadRequestException('title is required.');
    }
    if (priceVnd === null) {
      throw new BadRequestException('priceVnd is required.');
    }

    const created = await this.prisma.service.create({
      data: {
        expertId: expertUserId,
        title,
        description: description ?? null,
        domainsJson: dto.domainsJson ?? [],
        seamsJson: dto.seamsJson ?? [],
        priceVnd,
        serviceType: dto.serviceType,
        state: 'DRAFT',
      },
    });
    // Prisma BigInt → string: JSON.stringify cannot serialize BigInt.
    return { ...created, priceVnd: created.priceVnd.toString() };
  }

  // PUT /services/:id — owner updates draft listing or transitions DRAFT → PUBLISHED.
  // Blueprint: docs/04-endpoints.md §0.11 K row 136.
  // - Actor: EXPERT (owner).
  // - Gate: [None].
  // - Guard: not owner → 403 · state = SUSPENDED → 422.
  // - Transition: DRAFT → PUBLISHED only. service_type immutable after PUBLISHED.
  async update(id: string, expertUserId: string, dto: UpdateListingDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    // Ownership guard
    if (service.expertId !== expertUserId) {
      throw new ForbiddenException('Only the service owner can update this listing.');
    }

    // Admin-suspended lock
    if (service.state === 'SUSPENDED') {
      throw new UnprocessableEntityException('Admin-suspended listings cannot be self-edited.');
    }

    // serviceType immutability after PUBLISHED
    if (
      dto.serviceType &&
      service.serviceType !== dto.serviceType &&
      service.state === 'PUBLISHED'
    ) {
      throw new UnprocessableEntityException('serviceType is immutable after PUBLISHED.');
    }

    // State transition: only DRAFT → PUBLISHED
    if (dto.state) {
      if (service.state !== 'DRAFT') {
        throw new UnprocessableEntityException('Only DRAFT listings can be published.');
      }
      if (dto.state !== 'PUBLISHED') {
        throw new UnprocessableEntityException('Only PUBLISHED transition is allowed.');
      }
    }

    // Build partial update payload. Only set fields that were actually sent.
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.domainsJson !== undefined) data.domainsJson = dto.domainsJson;
    if (dto.seamsJson !== undefined) data.seamsJson = dto.seamsJson;
    if (dto.priceVnd !== undefined) data.priceVnd = BigInt(dto.priceVnd);
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.serviceType !== undefined) data.serviceType = dto.serviceType;

    const updated = await this.prisma.service.update({
      where: { id },
      data,
    });
    return { ...updated, priceVnd: updated.priceVnd.toString() };
  }

  // POST /services/:id/purchase — CEO purchases a published service.
  // Blueprint: docs/04-endpoints.md §0.11 K row 137.
  // - Actor: CEO (CLIENT with client_subtype = CEO).
  // - Gate: [None].
  // - Guard: active_role != CLIENT OR client_subtype != CEO → 403
  //   · state != PUBLISHED → 422 · balance < price → 422 INSUFFICIENT_BALANCE.
  // - W: engagements, virtual_accounts.
  // - Returns: engagement, virtual_account, VietQR URL.
  // - IPN fires later to advance engagement to ACTIVE.
  async purchase(id: string, buyer: Buyer) {
    // 1. Fetch service
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { expert: { select: { fullName: true } } },
    });
    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    // 2. Service state gate
    if (service.state !== 'PUBLISHED') {
      throw new UnprocessableEntityException('Only PUBLISHED services can be purchased.');
    }

    // 3. Buyer role gate
    if (buyer.activeRole !== 'CLIENT' || buyer.clientSubtype !== 'CEO') {
      throw new ForbiddenException('Only CEO clients can purchase services.');
    }

    // 4. Wallet balance gate
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: buyer.id },
    });
    if (!wallet || wallet.availableBalance < service.priceVnd) {
      throw new UnprocessableEntityException('INSUFFICIENT_BALANCE');
    }

    // 5. Determine engagement type from service.service_type
    const engagementType =
      service.serviceType === 'AI_SERVICE' ? 'SERVICE_PURCHASE' : 'TECH_DISCOVERY';

    // 6. Create engagement + per-order VA atomically.
    // VA entityId must be engagement.id — $transaction (callback) lets us
    // create the engagement first, then reference its id in the VA insert.
    const result = await this.prisma.$transaction(async (tx) => {
      const engagement = await tx.engagement.create({
        data: {
          expertId: service.expertId,
          serviceId: id,
          type: engagementType,
          state: 'PENDING',
        },
      });

      const vaNumber = generateVaNumber(VAEntityType.SERVICE);

      // Per-order VA for service purchase. Fixed amount = service price so
      // IPN handler can match the payment. Expires in 24h.
      const va = await tx.virtualAccount.create({
        data: {
          entityType: VAEntityType.SERVICE,
          entityId: engagement.id,
          vaNumber,
          fixedAmount: service.priceVnd,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: VAStatus.ACTIVE,
        },
      });

      return { engagement, va };
    });

    // 7. Build VietQR URL. Same bank account as wallet top-up (SePay platform).
    // Pattern from wallet.service.ts; platform bank account is hardcoded.
    const vietqrUrl = [
      'https://qr.sepay.vn/img',
      '?bank=MBBank',
      '&acc=0394654576',
      '&template=compact',
      `&amount=${service.priceVnd.toString()}`,
      `&des=${result.va.vaNumber}`,
    ].join('');

    return {
      engagement: result.engagement,
      virtualAccount: {
        ...result.va,
        fixedAmount: result.va.fixedAmount !== null ? result.va.fixedAmount.toString() : null,
      },
      vietqrUrl,
    };
  }
}
