import { ConflictException } from '@nestjs/common';
import { acceptedOffer, isNegotiationEnvelope } from '../bids/bid-negotiation';
import type { PrismaService } from '../database/prisma.service';

export function bidHasAcceptedTerms(
  bid: { conditionalPricingJson: unknown } | null | undefined,
): boolean {
  return Boolean(
    bid &&
      isNegotiationEnvelope(bid.conditionalPricingJson) &&
      acceptedOffer(bid.conditionalPricingJson),
  );
}

export function throwMilestoneTermsLocked(): never {
  throw new ConflictException({
    error: 'MILESTONE_TERMS_LOCKED',
    message: 'Accepted milestone terms cannot be edited.',
  });
}

export async function assertProjectMilestoneTermsEditable(
  prisma: PrismaService,
  projectId: string,
) {
  const bid = await prisma.capabilityBid.findFirst({
    where: {
      engagement: { projectId, type: 'PROJECT_BASED' },
      state: 'SELECTED',
    },
    select: { conditionalPricingJson: true },
  });
  if (bidHasAcceptedTerms(bid)) throwMilestoneTermsLocked();
}

export async function assertEngagementMilestoneTermsEditable(
  prisma: PrismaService,
  engagementId: string,
) {
  const bid = await prisma.capabilityBid.findUnique({
    where: { engagementId },
    select: { conditionalPricingJson: true },
  });
  if (bidHasAcceptedTerms(bid)) throwMilestoneTermsLocked();
}

export async function assertMilestoneTermsEditable(
  prisma: PrismaService,
  milestoneId: string,
) {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      engagement: {
        select: {
          capabilityBid: { select: { conditionalPricingJson: true } },
        },
      },
    },
  });
  if (bidHasAcceptedTerms(milestone?.engagement.capabilityBid)) {
    throwMilestoneTermsLocked();
  }
}
