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
import { EventEmitter2 } from '@nestjs/event-emitter';

type Actor = { id: string; activeRole: string };

type Buyer = { id: string; activeRole: string; clientSubtype?: string };

// Hard cap on rows returned by GET /services browse.
const SERVICE_BROWSE_LIMIT = 50;

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapiClient: FastapiClient,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async list(filter: ListServicesFilterDto) {
    const where: any = {
      state: 'PUBLISHED',
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
      where.domainsJson = { array_contains: filter.domains };
    }

    if (filter.seams && filter.seams.length > 0) {
      where.seamsJson = { array_contains: filter.seams };
    }

    const services = await this.prisma.service.findMany({
      where,
      take: SERVICE_BROWSE_LIMIT,
    });
    return services.map((s) => ({
      ...s,
      priceVnd: s.priceVnd.toString(),
    }));
  }

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
    
    let isPurchaser = false;
    if (actor.activeRole === 'CLIENT') {
      const engagement = await this.prisma.engagement.findFirst({
        where: {
          clientId: actor.id,
          serviceId: id,
          state: { not: 'DECLINED' },
        },
      });
      isPurchaser = !!engagement;
    }

    if (service.state !== 'PUBLISHED' && !isOwner && !isAdmin && !isPurchaser) {
      throw new NotFoundException('Service not found.');
    }

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

  async create(expertUserId: string, dto: CreateListingDto) {
    let title = dto.title;
    let description = dto.description;
    let scope = dto.scope;
    let timeline = dto.timeline;

    // Unconditionally fetch expert's verified competencies from DB
    const [domainDepths, seamClaims] = await Promise.all([
      this.prisma.expertDomainDepth.findMany({
        where: { expertId: expertUserId },
      }),
      this.prisma.expertSeamClaim.findMany({
        where: { expertId: expertUserId },
      }),
    ]);

    // Unconditionally use expert profile data for domains and seams
    let domainsJson = domainDepths.map(d => d.domainCode);
    let seamsJson = seamClaims.map(s => s.seamCode);
    let priceVnd: bigint | null = dto.priceVnd !== undefined ? BigInt(dto.priceVnd) : null;

    if (dto.useAiGenerator) {
      // 1. Fetch expert and verify Pro status (E5 / C-4)
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

      if (!dto.capabilities || dto.capabilities.length === 0) {
        throw new BadRequestException('capabilities is required when useAiGenerator=true.');
      }
      if (!dto.targetUseCases || dto.targetUseCases.length === 0) {
        throw new BadRequestException('targetUseCases is required when useAiGenerator=true.');
      }

      // 3. Call AI with rich context
      const ai = await this.fastapiClient.serviceGenerate({
        expert_capabilities: dto.capabilities,
        target_use_cases: dto.targetUseCases,
        claimed_domains: domainDepths.map(d => ({
          code: d.domainCode,
          depth: d.depthLevel,
        })),
        claimed_seams: seamClaims.map(s => ({
          code: s.seamCode,
        })),
        is_pro_expert: expert.subscriptionExpertTier === 'pro',
      });

      title = dto.title ?? ai.title;
      description = dto.description ?? ai.description;
      const aiScopeStr = Array.isArray(ai.scope)
        ? ai.scope.join('\n')
        : (ai.scope ?? '');
      scope = dto.scope ?? aiScopeStr;
      timeline = dto.timeline ?? ai.timeline;

      if (priceVnd === null) {
        priceVnd = BigInt(ai.suggested_price_vnd);
      }
    }

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
        scope: scope ?? null,
        timeline: timeline ?? null,
        domainsJson: domainsJson as any,
        seamsJson: seamsJson as any,
        priceVnd,
        serviceType: dto.serviceType,
        state: 'DRAFT',
      },
    });
    return { ...created, priceVnd: created.priceVnd.toString() };
  }

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
    if (dto.scope !== undefined) data.scope = dto.scope;
    if (dto.timeline !== undefined) data.timeline = dto.timeline;
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
    // Note: remove the wallet balance, otherwise will prevent the client from chatting with the expert first before proceed buying service
    if (!wallet) {
      throw new UnprocessableEntityException('CAN NOT FOUND USER WALLET!');
    }

    // 5. Check if they already have an ACTIVE engagement for this service.
    const existingActive = await this.prisma.engagement.findFirst({
      where: {
        serviceId: id,
        clientId: buyer.id,
        state: 'ACTIVE',
      },
    });

    if (existingActive) {
      return {
        engagement: existingActive,
        virtualAccount: null,
        vietqrUrl: '',
      };
    }

    // 5b. Check if they already have a PENDING engagement for this service to reuse.
    const existingPending = await this.prisma.engagement.findFirst({
      where: {
        serviceId: id,
        clientId: buyer.id,
        state: 'PENDING',
      },
    });

    const engagementType =
      service.serviceType === 'AI_SERVICE' ? 'SERVICE_PURCHASE' : 'TECH_DISCOVERY';

    // 6. Create engagement + per-order VA atomically.
    const result = await this.prisma.$transaction(async (tx) => {
      let engagement = existingPending;
      if (!engagement) {
        engagement = await tx.engagement.create({
          data: {
            expertId: service.expertId,
            clientId: buyer.id,
            serviceId: id,
            type: engagementType,
            state: 'PENDING',
          },
        });
      }

      // Reuse active VA if valid, otherwise create a new one
      let va = await tx.virtualAccount.findFirst({
        where: {
          entityType: VAEntityType.SERVICE,
          entityId: engagement.id,
          status: VAStatus.ACTIVE,
          expiresAt: { gte: new Date() },
        },
      });

      if (!va) {
        const vaNumber = generateVaNumber(VAEntityType.SERVICE);
        va = await tx.virtualAccount.create({
          data: {
            entityType: VAEntityType.SERVICE,
            entityId: engagement.id,
            vaNumber,
            fixedAmount: service.priceVnd,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: VAStatus.ACTIVE,
          },
        });
      }

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

    // Emit notification to the expert about the new engagement/chat thread
    try {
      const buyerUser = await this.prisma.user.findUnique({
        where: { id: buyer.id },
        select: { fullName: true },
      });
      this.eventEmitter.emit('socket.broadcast', {
        userId: service.expertId,
        event: 'notification:generic',
        payload: {
          type: 'system',
          title: 'New Service Order / Chat',
          body: `${buyerUser?.fullName || 'A client'} has initiated a workspace chat for your service "${service.title}".`,
          link: `/expert/messages`,
        },
      });
    } catch (_err) {
      // ignore broadcast failures
    }

    return {
      engagement: result.engagement,
      virtualAccount: {
        ...result.va,
        fixedAmount: result.va.fixedAmount !== null ? result.va.fixedAmount.toString() : null,
      },
      vietqrUrl,
    };
  }

  async delete(id: string, expertUserId: string) {
    const svc = await this.prisma.service.findUnique({ where: { id }, 
      // include the engagement of this service for checking before proceed delete
      include: { engagements: true } });
    if (!svc) throw new NotFoundException('Service not found.');
    if (svc.expertId !== expertUserId) throw new ForbiddenException('Not your listing.');
    if (svc.state !== 'DRAFT') {
      throw new UnprocessableEntityException('Can only delete DRAFT listings. Unpublish first.');
    }

    // Checking if this service has engagement inside -> not allow to delete even though the state of the service is DRAFT
    if (svc.engagements.length > 0) {
      throw new UnprocessableEntityException('Can only delete service without ENGAGEMENTS')
    }
    
    return this.prisma.service.delete({ where: { id } });
  }

  async myListings(expertUserId: string) {
    const services = await this.prisma.service.findMany({
      where: { expertId: expertUserId },
      orderBy: { createdAt: 'desc' },
    });
    return services.map(s => ({ ...s, priceVnd: s.priceVnd.toString() }));
  }

  async myPurchases(clientUserId: string) {
    const purchases = await this.prisma.engagement.findMany({
      where: { 
        clientId: clientUserId, 
        type: { in: ['SERVICE_PURCHASE', 'TECH_DISCOVERY'] },
        state: { not: 'DECLINED' }
      },
      include: {
        service: true,
      },
      orderBy: { id: 'desc' },
    });

    // Hide duplicate PENDING service purchases if there is already an ACTIVE one for the same service
    const activeServiceIds = new Set(
      purchases
        .filter(p => p.state === 'ACTIVE' && p.serviceId)
        .map(p => p.serviceId)
    );

    const filteredPurchases = purchases.filter(p => {
      if (p.state === 'PENDING' && p.serviceId && activeServiceIds.has(p.serviceId)) {
        return false;
      }
      return true;
    });

    return filteredPurchases.map((p) => {
      if (p.service) {
        return {
          ...p,
          service: {
            ...p.service,
            priceVnd: p.service.priceVnd.toString(),
          },
        };
      }
      return p;
    });
  }

  async setPublishState(id: string, expertUserId: string, newState: 'PUBLISHED' | 'DRAFT') {
    const svc = await this.prisma.service.findUnique({ where: { id } });
    if (!svc) throw new NotFoundException('Service not found.');
    if (svc.expertId !== expertUserId) throw new ForbiddenException('Not your listing.');
    if (newState === 'PUBLISHED' && svc.state !== 'DRAFT') {
      throw new UnprocessableEntityException('Can only publish listings in DRAFT state.');
    }
    if (newState === 'DRAFT' && svc.state !== 'PUBLISHED') {
      throw new UnprocessableEntityException('Can only unpublish listings in PUBLISHED state.');
    }
    const updated = await this.prisma.service.update({
      where: { id }, data: { state: newState },
    });
    return { ...updated, priceVnd: updated.priceVnd.toString() };
  }
}