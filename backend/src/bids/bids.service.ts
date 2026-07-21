import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { deriveMilestoneReviewAuthority } from '../milestones/milestone-review-flow';
import {
  acceptedOffer,
  BidNegotiationEnvelope,
  BidOffer,
  currentOffer,
  deriveNegotiationState,
  hasTechnicalScopeChange,
  isNegotiationEnvelope,
  MilestoneOfferTerm,
  NegotiationRole,
  normalizeMilestoneTerms,
  toProjectMilestoneMirror,
  totalOfferPrice,
} from './bid-negotiation';
import { ShortlistService } from './shortlist.service';
import { CeoDecisionDto } from './dto/ceo-decision.dto';
import { CounterOfferDto } from './dto/counter-offer.dto';
import { CreateBidDto } from './dto/create-bid.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { TechReviewDto } from './dto/tech-review.dto';
import { UpdateBidDto } from './dto/update-bid.dto';

type ActorUser = { id: string; activeRole: string; clientSubtype?: string };

const BID_DETAIL_INCLUDE = {
  engagement: {
    include: {
      expert: { select: { id: true, fullName: true } },
      project: {
        select: {
          id: true,
          clientId: true,
          projectName: true,
          state: true,
          tier: true,
          selfTechnical: true,
          milestoneFrameworkJson: true,
        },
      },
      milestones: {
        orderBy: { milestoneNumber: 'asc' as const },
        include: { acceptanceCriteria: true },
      },
    },
  },
} as const;

@Injectable()
export class BidsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shortlistService: ShortlistService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(expertUserId: string, dto: CreateBidDto) {
    const [expert, project] = await Promise.all([
      this.prisma.expertProfile.findUnique({
        where: { userId: expertUserId },
        include: { user: { select: { subscriptionExpertTier: true } } },
      }),
      this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: {
          id: true,
          clientId: true,
          state: true,
          tier: true,
          selfTechnical: true,
          milestoneFrameworkJson: true,
        },
      }),
    ]);

    if (!expert) throw new NotFoundException('Expert profile not found.');
    if (!project) throw new NotFoundException('Project not found.');
    if (project.state !== 'PUBLISHED') {
      throw new UnprocessableEntityException(
        `Project is in state ${project.state}; bidding requires PUBLISHED.`,
      );
    }
    if (project.clientId === expertUserId) {
      throw new ForbiddenException('Project owner cannot bid on their own project.');
    }
    if (project.tier !== 'TIER_1' && expert.user.subscriptionExpertTier !== 'pro') {
      throw new ForbiddenException('Expert Pro subscription required for Tier 2-3 projects.');
    }

    const [isShortlisted, existing] = await Promise.all([
      this.shortlistService.isExpertShortlisted(project.id, expertUserId),
      this.prisma.engagement.findFirst({
        where: { projectId: project.id, expertId: expertUserId, type: 'PROJECT_BASED' },
      }),
    ]);
    if (!isShortlisted) throw new ForbiddenException('Expert is not in this project shortlist.');
    if (existing) {
      throw new ConflictException('An engagement already exists for this expert on this project.');
    }

    const terms = normalizeMilestoneTerms(
      project.milestoneFrameworkJson,
      dto.conditional_pricing_json,
    );
    const offer = this.buildOffer(1, expertUserId, 'EXPERT', 'CEO', terms, 1);
    const technicalReviewRequired = !project.selfTechnical;
    const envelope: BidNegotiationEnvelope = {
      formatVersion: 1,
      offers: [offer],
      currentOfferId: offer.id,
      technicalReview: {
        scopeVersion: 1,
        status: technicalReviewRequired ? 'PENDING' : 'APPROVED',
        intendedRecipient: 'CEO',
      },
    };

    const result = await this.runSerializable(async (tx) => {
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
          footprintAlignmentJson: dto.footprint_alignment_json as any,
          approachSummary: dto.approach_summary,
          conditionalPricingJson: envelope as any,
          state: 'SUBMITTED',
          techStatus: technicalReviewRequired ? 'PENDING' : 'APPROVED',
          ceoStatus: 'PENDING',
          negotiatedPriceVnd: BigInt(totalOfferPrice(terms)),
          versionNumber: 1,
        },
      });
      await tx.invitation.updateMany({
        where: { projectId: project.id, expertId: expertUserId, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      const techTeamMembers = technicalReviewRequired
        ? await tx.techTeamProfile.findMany({
            where: { linkedProjectId: project.id },
            select: { userId: true },
          })
        : [];
      return { engagement, bid, techTeamMembers };
    });

    this.notify(project.clientId, {
      type: 'bid_update',
      title: 'New Expert Bid!',
      body: 'An expert submitted a capability bid for your project.',
      link: `/ceo/projects/${project.id}/bids`,
    });
    for (const member of result.techTeamMembers) {
      this.notify(member.userId, {
        type: 'bid_update',
        title: 'New Bid Awaiting Review',
        body: 'An expert bid requires technical review.',
        link: `/tech-team/bids/${result.bid.id}`,
      });
    }

    return this.findById(result.bid.id, {
      id: expertUserId,
      activeRole: 'EXPERT',
    });
  }

  async findById(bidId: string, user: ActorUser) {
    const bid = await this.prisma.capabilityBid.findUnique({
      where: { id: bidId },
      include: BID_DETAIL_INCLUDE,
    });
    if (!bid) throw new NotFoundException('Bid not found.');

    const engagement = bid.engagement;
    const isAdmin = user.activeRole === 'ADMIN';
    const isExpert = user.activeRole === 'EXPERT' && engagement.expertId === user.id;
    const isCeo =
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'CEO' &&
      engagement.clientId === user.id;
    const isTechTeam =
      user.activeRole === 'CLIENT' &&
      user.clientSubtype === 'TECH_TEAM' &&
      !engagement.project.selfTechnical &&
      Boolean(engagement.projectId) &&
      (await this.isLinkedTechTeam(engagement.projectId!, user.id));
    if (!isAdmin && !isExpert && !isCeo && !isTechTeam) {
      throw new ForbiddenException('You are not a party to this bid.');
    }

    return this.toBidResponse(bid, isTechTeam);
  }

  async findAll(user: ActorUser, projectId?: string) {
    let where: Prisma.CapabilityBidWhereInput;
    let restrictedTechnicalView = false;

    if (user.activeRole === 'EXPERT') {
      where = { engagement: { expertId: user.id, ...(projectId ? { projectId } : {}) } };
    } else if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') {
      where = {
        engagement: {
          clientId: user.id,
          ...(projectId ? { projectId } : {}),
        },
      };
    } else if (user.activeRole === 'CLIENT' && user.clientSubtype === 'TECH_TEAM') {
      restrictedTechnicalView = true;
      where = {
        engagement: {
          ...(projectId ? { projectId } : {}),
          project: {
            selfTechnical: false,
            techTeamProfiles: { some: { userId: user.id } },
          },
        },
      };
    } else if (user.activeRole === 'ADMIN') {
      where = projectId ? { engagement: { projectId } } : {};
    } else {
      return [];
    }

    const bids = await this.prisma.capabilityBid.findMany({
      where,
      include: BID_DETAIL_INCLUDE,
      orderBy: { id: 'desc' },
      take: user.activeRole === 'ADMIN' ? 100 : undefined,
    });
    return bids.map((bid) => this.toBidResponse(bid, restrictedTechnicalView));
  }

  async update(bidId: string, expertUserId: string, dto: UpdateBidDto) {
    const result = await this.runSerializable(async (tx) => {
      const bid = await tx.capabilityBid.findUnique({
        where: { id: bidId },
        include: BID_DETAIL_INCLUDE,
      });
      if (!bid) throw new NotFoundException('Bid not found.');
      if (bid.engagement.expertId !== expertUserId) {
        throw new ForbiddenException('You do not own this bid.');
      }
      if (
        bid.engagement.project.tier !== 'TIER_1' &&
        !(await this.isExpertPro(expertUserId, tx))
      ) {
        throw new ForbiddenException(
          'Expert Pro subscription required to revise bids on Tier 2-3 projects.',
        );
      }
      if (bid.techStatus !== 'REVISION_REQUESTED') {
        throw new UnprocessableEntityException(
          `Bid is in tech_status ${bid.techStatus}; revisions require REVISION_REQUESTED.`,
        );
      }

      const envelope = this.requireEnvelope(bid);
      const previous = currentOffer(envelope);
      if (previous.proposerRole !== 'EXPERT') {
        throw new ForbiddenException('The current technical revision belongs to the CEO.');
      }
      const version = bid.versionNumber + 1;
      const terms = normalizeMilestoneTerms(
        bid.engagement.project.milestoneFrameworkJson,
        dto.conditional_pricing_json,
      );
      previous.state = 'SUPERSEDED';
      previous.respondedAt = new Date().toISOString();
      const next = this.buildOffer(
        version,
        expertUserId,
        'EXPERT',
        previous.recipientRole,
        terms,
        version,
      );
      envelope.offers.push(next);
      envelope.currentOfferId = next.id;
      const technicalReviewRequired = !bid.engagement.project.selfTechnical;
      envelope.technicalReview = {
        scopeVersion: version,
        status: technicalReviewRequired ? 'PENDING' : 'APPROVED',
        intendedRecipient: next.recipientRole,
      };

      return tx.capabilityBid.update({
        where: { id: bidId },
        data: {
          footprintAlignmentJson: dto.footprint_alignment_json as any,
          approachSummary: dto.approach_summary,
          conditionalPricingJson: envelope as any,
          techStatus: technicalReviewRequired ? 'PENDING' : 'APPROVED',
          techFeedback: null,
          state: technicalReviewRequired ? 'TECH_REVIEW' : 'SUBMITTED',
          negotiatedPriceVnd: BigInt(totalOfferPrice(terms)),
          versionNumber: version,
        },
      });
    });

    return this.findById(result.id, { id: expertUserId, activeRole: 'EXPERT' });
  }

  async techReview(bidId: string, user: ActorUser, dto: TechReviewDto) {
    if (user.activeRole !== 'CLIENT' || user.clientSubtype !== 'TECH_TEAM') {
      throw new ForbiddenException('Only TECH_TEAM can review bids.');
    }

    const result = await this.runSerializable(async (tx) => {
      const bid = await tx.capabilityBid.findUnique({
        where: { id: bidId },
        include: BID_DETAIL_INCLUDE,
      });
      if (!bid) throw new NotFoundException('Bid not found.');
      if (['SELECTED', 'DECLINED', 'WITHDRAWN'].includes(bid.state)) {
        throw new UnprocessableEntityException(`Bid is in state ${bid.state}; cannot review.`);
      }
      if (bid.engagement.project.selfTechnical) {
        throw new UnprocessableEntityException('TECH_REVIEW_NOT_REQUIRED');
      }
      if (!(await this.isLinkedTechTeam(bid.engagement.projectId!, user.id, tx))) {
        throw new ForbiddenException('TECH_TEAM is not linked to this project.');
      }

      const envelope = this.requireEnvelope(bid);
      const offer = currentOffer(envelope);
      if (offer.technicalScopeVersion !== envelope.technicalReview.scopeVersion) {
        throw new ConflictException('STALE_OFFER_VERSION');
      }
      if (!['PENDING', 'REVISION_REQUESTED'].includes(envelope.technicalReview.status)) {
        throw new ConflictException('TECH_REVIEW_ALREADY_COMPLETE');
      }

      const reviewedAt = new Date().toISOString();
      envelope.technicalReview = {
        ...envelope.technicalReview,
        status: dto.action,
        reviewedAt,
        feedback: dto.action === 'REVISION_REQUESTED' ? dto.tech_feedback : undefined,
      };
      const updated = await tx.capabilityBid.update({
        where: { id: bidId },
        data: {
          conditionalPricingJson: envelope as any,
          techStatus: dto.action,
          techFeedback: dto.action === 'REVISION_REQUESTED' ? dto.tech_feedback : null,
          state: dto.action === 'APPROVED' ? 'SUBMITTED' : 'TECH_REVIEW',
        },
      });
      return {
        updated,
        engagement: bid.engagement,
        proposerUserId: offer.proposerUserId,
        recipientRole: offer.recipientRole,
      };
    });

    if (dto.action === 'REVISION_REQUESTED') {
      this.notify(result.proposerUserId, {
        type: 'bid_update',
        title: 'Technical Revision Requested',
        body: dto.tech_feedback || 'The Tech Team requested changes to the technical scope.',
        link:
          result.recipientRole === 'CEO'
            ? `/expert/engagements/${result.engagement.id}/bid`
            : `/ceo/projects/${result.engagement.projectId}/bids/${bidId}`,
      });
    } else {
      const recipientId =
        result.recipientRole === 'CEO'
          ? result.engagement.clientId
          : result.engagement.expertId;
      this.notify(recipientId, {
        type: 'bid_update',
        title: 'Technical Review Approved',
        body: 'The offer is ready for your commercial decision.',
        link:
          result.recipientRole === 'CEO'
            ? `/ceo/projects/${result.engagement.projectId}/bids/${bidId}`
            : `/expert/engagements/${result.engagement.id}/bid`,
      });
    }

    return this.findById(result.updated.id, user);
  }

  async createOffer(bidId: string, user: ActorUser, dto: CreateOfferDto) {
    const actorRole = this.commercialRole(user);
    const result = await this.runSerializable(async (tx) => {
      const bid = await tx.capabilityBid.findUnique({
        where: { id: bidId },
        include: BID_DETAIL_INCLUDE,
      });
      if (!bid) throw new NotFoundException('Bid not found.');
      this.assertCommercialParty(bid.engagement, user, actorRole);
      if (['SELECTED', 'DECLINED', 'WITHDRAWN'].includes(bid.state)) {
        throw new ConflictException('BID_NEGOTIATION_CLOSED');
      }

      const envelope = this.requireEnvelope(bid);
      const previous = currentOffer(envelope);
      const technicalReviewRequired = !bid.engagement.project.selfTechnical;
      if (dto.respondingToVersion !== bid.versionNumber || previous.version !== bid.versionNumber) {
        throw new ConflictException('STALE_OFFER_VERSION');
      }

      const isTechnicalRevision = envelope.technicalReview.status === 'REVISION_REQUESTED';
      if (isTechnicalRevision) {
        if (previous.proposerRole !== actorRole || previous.proposerUserId !== user.id) {
          throw new ForbiddenException('Only the current proposer may submit the requested revision.');
        }
      } else {
        if (technicalReviewRequired && envelope.technicalReview.status !== 'APPROVED') {
          throw new UnprocessableEntityException('TECH_REVIEW_INCOMPLETE');
        }
        if (previous.recipientRole !== actorRole) {
          throw new ForbiddenException('Only the current offer recipient may counter.');
        }
      }

      const terms = normalizeMilestoneTerms(
        bid.engagement.project.milestoneFrameworkJson,
        dto.milestones,
      );
      const version = bid.versionNumber + 1;
      const recipientRole = isTechnicalRevision
        ? previous.recipientRole
        : this.oppositeRole(actorRole);
      const scopeChanged =
        isTechnicalRevision || hasTechnicalScopeChange(previous.milestones, terms);
      const requiresTechnicalReview = technicalReviewRequired && scopeChanged;
      const technicalScopeVersion = scopeChanged ? version : previous.technicalScopeVersion;

      previous.state = 'SUPERSEDED';
      previous.respondedAt = new Date().toISOString();
      const next = this.buildOffer(
        version,
        user.id,
        actorRole,
        recipientRole,
        terms,
        technicalScopeVersion,
      );
      envelope.offers.push(next);
      envelope.currentOfferId = next.id;
      envelope.technicalReview = {
        scopeVersion: technicalScopeVersion,
        status: requiresTechnicalReview ? 'PENDING' : 'APPROVED',
        intendedRecipient: recipientRole,
        ...(requiresTechnicalReview ? {} : { reviewedAt: envelope.technicalReview.reviewedAt }),
      };

      const updated = await tx.capabilityBid.update({
        where: { id: bidId },
        data: {
          conditionalPricingJson: envelope as any,
          versionNumber: version,
          negotiatedPriceVnd: BigInt(totalOfferPrice(terms)),
          techStatus: requiresTechnicalReview ? 'PENDING' : 'APPROVED',
          techFeedback: null,
          ceoStatus: 'PENDING',
          state: requiresTechnicalReview ? 'TECH_REVIEW' : 'SUBMITTED',
        },
      });
      return { updated, engagement: bid.engagement, requiresTechnicalReview, recipientRole };
    });

    if (result.requiresTechnicalReview) {
      const reviewers = await this.prisma.techTeamProfile.findMany({
        where: { linkedProjectId: result.engagement.projectId },
        select: { userId: true },
      });
      for (const reviewer of reviewers) {
        this.notify(reviewer.userId, {
          type: 'bid_update',
          title: 'Updated Scope Awaiting Review',
          body: 'A negotiation offer changed technical scope and requires review.',
          link: `/tech-team/bids/${bidId}`,
        });
      }
    } else {
      const recipientId =
        result.recipientRole === 'CEO'
          ? result.engagement.clientId
          : result.engagement.expertId;
      this.notify(recipientId, {
        type: 'bid_update',
        title: 'New Counter Offer',
        body: 'A new offer is ready for your decision.',
        link:
          result.recipientRole === 'CEO'
            ? `/ceo/projects/${result.engagement.projectId}/bids/${bidId}`
            : `/expert/engagements/${result.engagement.id}/bid`,
      });
    }

    return this.findById(result.updated.id, user);
  }

  async acceptOffer(bidId: string, offerId: string, user: ActorUser) {
    const actorRole = this.commercialRole(user);
    const result = await this.runSerializable(async (tx) => {
      const bid = await tx.capabilityBid.findUnique({
        where: { id: bidId },
        include: BID_DETAIL_INCLUDE,
      });
      if (!bid) throw new NotFoundException('Bid not found.');
      this.assertCommercialParty(bid.engagement, user, actorRole);

      const envelope = this.requireEnvelope(bid);
      const offer = currentOffer(envelope);
      if (offer.id !== offerId || offer.version !== bid.versionNumber) {
        throw new ConflictException('STALE_OFFER_VERSION');
      }
      const alreadyAccepted = acceptedOffer(envelope);
      if (
        alreadyAccepted?.id === offerId &&
        bid.state === 'SELECTED' &&
        bid.engagement.milestones.length === alreadyAccepted.milestones.length
      ) {
        return {
          bidId: bid.id,
          engagementId: bid.engagement.id,
          projectId: bid.engagement.projectId!,
          clientId: bid.engagement.clientId,
          expertId: bid.engagement.expertId,
          acceptedOffer: alreadyAccepted,
          milestonesCreated: bid.engagement.milestones.length,
          nextStep: 'NDA' as const,
          shouldNotify: false,
        };
      }
      if (offer.state !== 'PENDING') throw new ConflictException('OFFER_NOT_PENDING');
      if (offer.recipientRole !== actorRole) {
        throw new ForbiddenException('Only the current offer recipient may accept.');
      }
      if (
        !bid.engagement.project.selfTechnical &&
        (envelope.technicalReview.status !== 'APPROVED' ||
          envelope.technicalReview.scopeVersion !== offer.technicalScopeVersion)
      ) {
        throw new UnprocessableEntityException('TECH_REVIEW_INCOMPLETE');
      }
      if (alreadyAccepted) throw new ConflictException('OFFER_ALREADY_ACCEPTED');
      if (bid.engagement.state !== 'PENDING') {
        throw new UnprocessableEntityException('ENGAGEMENT_NOT_PENDING');
      }
      if (bid.engagement.milestones.length > 0) {
        throw new ConflictException('ACCEPTED_MILESTONES_ALREADY_EXIST');
      }

      const acceptedAt = new Date().toISOString();
      offer.milestones = normalizeMilestoneTerms(
        bid.engagement.project.milestoneFrameworkJson,
        offer.milestones,
      );
      offer.state = 'ACCEPTED';
      offer.respondedAt = acceptedAt;
      envelope.acceptedOfferId = offer.id;
      envelope.acceptedOfferVersion = offer.version;
      envelope.termsAcceptedAt = acceptedAt;

      const signOffAuthority = deriveMilestoneReviewAuthority(bid.engagement.project);
      const mirror = offer.milestones.map((term) =>
        toProjectMilestoneMirror(term, bid.id, offer.version, signOffAuthority),
      );

      const milestones = [];
      for (const term of offer.milestones) {
        const milestone = await tx.milestone.create({
          data: {
            engagementId: bid.engagement.id,
            milestoneNumber: term.milestone_number,
            deliverableStatement: term.deliverable_statement,
            signOffAuthority,
            paymentAmountVnd: BigInt(term.price_vnd),
            estimatedCostVnd: BigInt(term.price_vnd),
            estimatedDurationDays: term.estimated_duration_days ?? null,
            techStackJson: term.tech_stack ?? [],
            state: 'DEFINED',
            acceptanceCriteria: {
              create: term.criteria.map((criterion) => ({
                criterionText: criterion.criterion_text,
                isRequired: criterion.is_required,
                verifiedByRole: signOffAuthority,
              })),
            },
          },
          include: { acceptanceCriteria: true },
        });
        milestones.push(milestone);
      }

      await tx.project.update({
        where: { id: bid.engagement.projectId! },
        data: { milestoneFrameworkJson: mirror as any },
      });
      await tx.capabilityBid.update({
        where: { id: bid.id },
        data: {
          conditionalPricingJson: envelope as any,
          state: 'SELECTED',
          ceoStatus: 'APPROVED',
          negotiatedPriceVnd: BigInt(totalOfferPrice(offer.milestones)),
        },
      });

      const siblings = await tx.capabilityBid.findMany({
        where: {
          id: { not: bid.id },
          engagement: { projectId: bid.engagement.projectId, type: 'PROJECT_BASED' },
          state: { notIn: ['DECLINED', 'WITHDRAWN'] },
        },
      });
      for (const sibling of siblings) {
        const siblingEnvelope = isNegotiationEnvelope(sibling.conditionalPricingJson)
          ? sibling.conditionalPricingJson
          : undefined;
        if (siblingEnvelope) {
          const siblingCurrent = currentOffer(siblingEnvelope);
          if (siblingCurrent.state === 'PENDING') {
            siblingCurrent.state = 'DECLINED';
            siblingCurrent.respondedAt = acceptedAt;
          }
        }
        await tx.capabilityBid.update({
          where: { id: sibling.id },
          data: {
            state: 'DECLINED',
            ceoStatus: 'DECLINED',
            ...(siblingEnvelope
              ? { conditionalPricingJson: siblingEnvelope as any }
              : {}),
          },
        });
      }

      return {
        bidId: bid.id,
        engagementId: bid.engagement.id,
        projectId: bid.engagement.projectId!,
        clientId: bid.engagement.clientId,
        expertId: bid.engagement.expertId,
        acceptedOffer: offer,
        milestonesCreated: milestones.length,
        nextStep: 'NDA' as const,
        shouldNotify: true,
      };
    });

    if (result.shouldNotify) {
      const notifyUserId = actorRole === 'CEO' ? result.expertId : result.clientId;
      this.notify(notifyUserId, {
        type: 'bid_update',
        title: 'Offer Accepted',
        body: 'The agreed milestones are locked. NDA signatures are the next step.',
        link:
          actorRole === 'CEO'
            ? `/expert/engagements/${result.engagementId}/bid`
            : `/ceo/projects/${result.projectId}/bids/${result.bidId}`,
      });
    }
    return result;
  }

  async declineOffer(bidId: string, offerId: string, user: ActorUser) {
    const actorRole = this.commercialRole(user);
    const result = await this.runSerializable(async (tx) => {
      const bid = await tx.capabilityBid.findUnique({
        where: { id: bidId },
        include: BID_DETAIL_INCLUDE,
      });
      if (!bid) throw new NotFoundException('Bid not found.');
      this.assertCommercialParty(bid.engagement, user, actorRole);

      const envelope = this.requireEnvelope(bid);
      const offer = currentOffer(envelope);
      if (offer.id !== offerId || offer.version !== bid.versionNumber) {
        throw new ConflictException('STALE_OFFER_VERSION');
      }
      if (offer.state !== 'PENDING') throw new ConflictException('OFFER_NOT_PENDING');
      if (offer.recipientRole !== actorRole) {
        throw new ForbiddenException('Only the current offer recipient may decline.');
      }

      offer.state = 'DECLINED';
      offer.respondedAt = new Date().toISOString();
      await tx.capabilityBid.update({
        where: { id: bidId },
        data: {
          conditionalPricingJson: envelope as any,
          state: 'DECLINED',
          ceoStatus: 'DECLINED',
        },
      });
      return { engagement: bid.engagement };
    });

    const proposerId = actorRole === 'CEO' ? result.engagement.expertId : result.engagement.clientId;
    this.notify(proposerId, {
      type: 'bid_update',
      title: 'Offer Declined',
      body: 'The current offer was declined.',
      link:
        actorRole === 'CEO'
          ? `/expert/engagements/${result.engagement.id}/bid`
          : `/ceo/projects/${result.engagement.projectId}/bids/${bidId}`,
    });
    return { declined: true, bidId, offerId };
  }

  async ceoDecision(bidId: string, user: ActorUser, dto: CeoDecisionDto) {
    const bid = await this.prisma.capabilityBid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundException('Bid not found.');
    const envelope = this.requireEnvelope(bid);
    const offer = currentOffer(envelope);
    return dto.decision === 'APPROVED'
      ? this.acceptOffer(bidId, offer.id, user)
      : this.declineOffer(bidId, offer.id, user);
  }

  async counterOffer(_bidId: string, _user: ActorUser, _dto: CounterOfferDto) {
    throw new UnprocessableEntityException({
      error: 'COUNTER_OFFER_MILESTONES_REQUIRED',
      message: 'Use POST /bids/:id/offers with full per-milestone terms.',
    });
  }

  async reconcileLegacyBid(bidId: string, user: ActorUser) {
    const reconciled = await this.runSerializable(async (tx) => {
      const bid = await tx.capabilityBid.findUnique({
        where: { id: bidId },
        include: BID_DETAIL_INCLUDE,
      });
      if (!bid) throw new NotFoundException('Bid not found.');

      const isAdmin = user.activeRole === 'ADMIN';
      const isCeo =
        user.activeRole === 'CLIENT' &&
        user.clientSubtype === 'CEO' &&
        bid.engagement.clientId === user.id;
      const isExpert = user.activeRole === 'EXPERT' && bid.engagement.expertId === user.id;
      if (!isAdmin && !isCeo && !isExpert) {
        throw new ForbiddenException('You are not a party to this bid.');
      }

      if (isNegotiationEnvelope(bid.conditionalPricingJson)) {
        return { changed: false };
      }
      if (!bid.engagement.projectId || !bid.engagement.project) {
        throw new UnprocessableEntityException('LEGACY_PROJECT_BID_REQUIRED');
      }

      let terms: MilestoneOfferTerm[];
      if (Array.isArray(bid.conditionalPricingJson)) {
        terms = normalizeMilestoneTerms(
          bid.engagement.project.milestoneFrameworkJson,
          bid.conditionalPricingJson,
        );
      } else if (bid.engagement.milestones.length > 0) {
        terms = bid.engagement.milestones.map((milestone) => ({
          milestone_number: milestone.milestoneNumber,
          deliverable_statement: milestone.deliverableStatement || '',
          criteria: milestone.acceptanceCriteria.map((criterion) => ({
            criterion_text: criterion.criterionText,
            is_required: criterion.isRequired,
          })),
          price_vnd: Number(milestone.paymentAmountVnd),
          ...(milestone.estimatedDurationDays
            ? { estimated_duration_days: milestone.estimatedDurationDays }
            : {}),
          tech_stack: Array.isArray(milestone.techStackJson)
            ? (milestone.techStackJson as string[])
            : [],
        }));
      } else {
        throw new UnprocessableEntityException({
          error: 'LEGACY_BID_TERMS_INCOMPLETE',
          message: 'Legacy bid data has no deterministic per-milestone allocation.',
        });
      }

      const selected =
        bid.state === 'SELECTED' ||
        bid.ceoStatus === 'APPROVED' ||
        ['CONNECTED', 'ACTIVE', 'CLOSED', 'DISPUTED'].includes(bid.engagement.state);
      const existingByNumber = new Map(
        bid.engagement.milestones.map((milestone) => [milestone.milestoneNumber, milestone]),
      );
      for (const term of terms) {
        const existing = existingByNumber.get(term.milestone_number);
        if (!existing) continue;
        const existingCriteria = existing.acceptanceCriteria.map((criterion) => ({
          criterion_text: criterion.criterionText,
          is_required: criterion.isRequired,
        }));
        const mismatch =
          existing.deliverableStatement !== term.deliverable_statement ||
          Number(existing.paymentAmountVnd) !== term.price_vnd ||
          JSON.stringify(existingCriteria) !== JSON.stringify(term.criteria);
        if (mismatch) {
          throw new ConflictException({
            error: 'LEGACY_MILESTONE_MISMATCH',
            message: `Milestone ${term.milestone_number} differs from the recoverable bid snapshot and requires manual review.`,
          });
        }
      }

      const version = Math.max(1, bid.versionNumber);
      const offer = this.buildOffer(
        version,
        bid.engagement.expertId,
        'EXPERT',
        'CEO',
        terms,
        version,
      );
      const acceptedAt = (bid.engagement.connectedAt ?? new Date()).toISOString();
      if (selected) {
        offer.state = 'ACCEPTED';
        offer.respondedAt = acceptedAt;
      }
      const envelope: BidNegotiationEnvelope = {
        formatVersion: 1,
        offers: [offer],
        currentOfferId: offer.id,
        ...(selected
          ? {
              acceptedOfferId: offer.id,
              acceptedOfferVersion: offer.version,
              termsAcceptedAt: acceptedAt,
            }
          : {}),
        technicalReview: {
          scopeVersion: version,
          status:
            selected || bid.engagement.project.selfTechnical || bid.techStatus === 'APPROVED'
              ? 'APPROVED'
              : bid.techStatus === 'REVISION_REQUESTED'
                ? 'REVISION_REQUESTED'
                : 'PENDING',
          intendedRecipient: 'CEO',
          feedback: bid.techFeedback ?? undefined,
        },
      };

      if (selected) {
        const signOffAuthority = deriveMilestoneReviewAuthority(bid.engagement.project);
        for (const term of terms) {
          if (existingByNumber.has(term.milestone_number)) continue;
          await tx.milestone.create({
            data: {
              engagementId: bid.engagement.id,
              milestoneNumber: term.milestone_number,
              deliverableStatement: term.deliverable_statement,
              signOffAuthority,
              paymentAmountVnd: BigInt(term.price_vnd),
              estimatedCostVnd: BigInt(term.price_vnd),
              estimatedDurationDays: term.estimated_duration_days ?? null,
              techStackJson: term.tech_stack ?? [],
              state: 'DEFINED',
              acceptanceCriteria: {
                create: term.criteria.map((criterion) => ({
                  criterionText: criterion.criterion_text,
                  isRequired: criterion.is_required,
                  verifiedByRole: signOffAuthority,
                })),
              },
            },
          });
        }
        await tx.project.update({
          where: { id: bid.engagement.projectId },
          data: {
            milestoneFrameworkJson: terms.map((term) =>
              toProjectMilestoneMirror(term, bid.id, version, signOffAuthority),
            ) as any,
          },
        });
      }

      await tx.capabilityBid.update({
        where: { id: bid.id },
        data: {
          conditionalPricingJson: envelope as any,
          versionNumber: version,
          negotiatedPriceVnd: BigInt(totalOfferPrice(terms)),
          ...(selected
            ? { state: 'SELECTED', ceoStatus: 'APPROVED' }
            : bid.engagement.project.selfTechnical
              ? { state: 'SUBMITTED', techStatus: 'APPROVED', techFeedback: null }
              : {}),
        },
      });
      return { changed: true };
    });

    return {
      reconciled: reconciled.changed,
      bid: await this.findById(bidId, user),
    };
  }

  async withdraw(bidId: string, expertUserId: string) {
    const bid = await this.prisma.capabilityBid.findUnique({
      where: { id: bidId },
      include: { engagement: { select: { expertId: true } } },
    });
    if (!bid) throw new NotFoundException('Bid not found.');
    if (bid.engagement.expertId !== expertUserId) {
      throw new ForbiddenException('You do not own this bid.');
    }
    if (!['SUBMITTED', 'TECH_REVIEW'].includes(bid.state)) {
      throw new UnprocessableEntityException(
        `Cannot withdraw a bid in state '${bid.state}'.`,
      );
    }
    if (isNegotiationEnvelope(bid.conditionalPricingJson)) {
      const offer = currentOffer(bid.conditionalPricingJson);
      offer.state = 'DECLINED';
      offer.respondedAt = new Date().toISOString();
    }
    await this.prisma.capabilityBid.update({
      where: { id: bidId },
      data: {
        state: 'WITHDRAWN',
        ...(isNegotiationEnvelope(bid.conditionalPricingJson)
          ? { conditionalPricingJson: bid.conditionalPricingJson as any }
          : {}),
      },
    });
    return { withdrawn: true, bidId };
  }

  private buildOffer(
    version: number,
    proposerUserId: string,
    proposerRole: NegotiationRole,
    recipientRole: NegotiationRole,
    milestones: MilestoneOfferTerm[],
    technicalScopeVersion: number,
  ): BidOffer {
    return {
      id: randomUUID(),
      version,
      proposerUserId,
      proposerRole,
      recipientRole,
      milestones,
      state: 'PENDING',
      createdAt: new Date().toISOString(),
      technicalScopeVersion,
    };
  }

  private requireEnvelope(bid: { conditionalPricingJson: unknown }): BidNegotiationEnvelope {
    if (!isNegotiationEnvelope(bid.conditionalPricingJson)) {
      throw new UnprocessableEntityException({
        error: 'BID_NEGOTIATION_RECONCILIATION_REQUIRED',
        message: 'This legacy bid must be reconciled before negotiation can continue.',
      });
    }
    return bid.conditionalPricingJson;
  }

  private commercialRole(user: ActorUser): NegotiationRole {
    if (user.activeRole === 'EXPERT') return 'EXPERT';
    if (user.activeRole === 'CLIENT' && user.clientSubtype === 'CEO') return 'CEO';
    throw new ForbiddenException('Only the CEO and Expert may negotiate offers.');
  }

  private assertCommercialParty(
    engagement: { clientId: string; expertId: string },
    user: ActorUser,
    role: NegotiationRole,
  ) {
    if (role === 'CEO' && engagement.clientId !== user.id) {
      throw new ForbiddenException('You do not own this project.');
    }
    if (role === 'EXPERT' && engagement.expertId !== user.id) {
      throw new ForbiddenException('You do not own this bid.');
    }
  }

  private oppositeRole(role: NegotiationRole): NegotiationRole {
    return role === 'CEO' ? 'EXPERT' : 'CEO';
  }

  private toBidResponse(bid: any, restrictedTechnicalView: boolean) {
    const envelope = isNegotiationEnvelope(bid.conditionalPricingJson)
      ? bid.conditionalPricingJson
      : undefined;
    const offer = envelope ? currentOffer(envelope) : undefined;
    const accepted = envelope ? acceptedOffer(envelope) : undefined;
    const technicalReviewRequired = !bid.engagement.project.selfTechnical;
    const derived = envelope
      ? deriveNegotiationState(envelope, technicalReviewRequired)
      : {
          negotiationState:
            bid.state === 'SELECTED'
              ? 'TERMS_ACCEPTED'
              : bid.state === 'DECLINED'
                ? 'DECLINED'
                : !technicalReviewRequired || bid.techStatus === 'APPROVED'
                  ? 'AWAITING_CEO'
                  : 'AWAITING_TECH_REVIEW',
          nextActionBy:
            !technicalReviewRequired || bid.techStatus === 'APPROVED' ? 'CEO' : 'TECH_TEAM',
        };
    const ndaComplete = Boolean(
      bid.engagement.clientNdaAcceptedAt && bid.engagement.expertNdaAcceptedAt,
    );
    const technicalOffer = (candidate?: BidOffer) =>
      candidate
        ? {
            id: candidate.id,
            version: candidate.version,
            proposerRole: candidate.proposerRole,
            recipientRole: candidate.recipientRole,
            state: candidate.state,
            createdAt: candidate.createdAt,
            technicalScopeVersion: candidate.technicalScopeVersion,
            milestones: candidate.milestones.map((term) => ({
              milestone_number: term.milestone_number,
              deliverable_statement: term.deliverable_statement,
              criteria: term.criteria,
              estimated_duration_days: term.estimated_duration_days,
              tech_stack: term.tech_stack ?? [],
            })),
          }
        : undefined;

    return {
      ...bid,
      negotiatedPriceVnd:
        bid.negotiatedPriceVnd === null ? null : Number(bid.negotiatedPriceVnd),
      conditionalPricingJson: restrictedTechnicalView
        ? technicalOffer(offer)?.milestones ?? []
        : bid.conditionalPricingJson,
      currentOffer: restrictedTechnicalView ? technicalOffer(offer) : offer,
      acceptedOffer: restrictedTechnicalView ? technicalOffer(accepted) : accepted,
      offerHistory: restrictedTechnicalView ? undefined : envelope?.offers ?? [],
      negotiationState: derived.negotiationState,
      nextActionBy: derived.nextActionBy,
      termsLocked: Boolean(accepted),
      ndaComplete,
      termsAcceptedAt: envelope?.termsAcceptedAt,
      technicalReview:
        envelope?.technicalReview
          ? !technicalReviewRequired && envelope.technicalReview.status === 'PENDING'
            ? { ...envelope.technicalReview, status: 'APPROVED' }
            : envelope.technicalReview
          : {
              scopeVersion: bid.versionNumber,
              status: technicalReviewRequired ? bid.techStatus : 'APPROVED',
              intendedRecipient: 'CEO',
              feedback: bid.techFeedback,
            },
    };
  }

  private async isExpertPro(
    userId: string,
    client: Pick<Prisma.TransactionClient, 'user'> | PrismaService = this.prisma,
  ): Promise<boolean> {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { subscriptionExpertTier: true },
    });
    return user?.subscriptionExpertTier === 'pro';
  }

  private async isLinkedTechTeam(
    projectId: string,
    userId: string,
    client: Pick<Prisma.TransactionClient, 'techTeamProfile'> | PrismaService = this.prisma,
  ): Promise<boolean> {
    const tech = await client.techTeamProfile.findUnique({
      where: { userId },
      select: { linkedProjectId: true },
    });
    return tech?.linkedProjectId === projectId;
  }

  private notify(
    userId: string,
    payload: { type: string; title: string; body: string; link: string },
  ) {
    this.eventEmitter.emit('socket.broadcast', {
      userId,
      event: 'notification:generic',
      payload,
    });
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: any) {
        if (error?.code !== 'P2034' || attempt === 3) throw error;
      }
    }
    throw new ConflictException('BID_WRITE_CONFLICT');
  }
}
