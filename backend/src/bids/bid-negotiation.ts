import { UnprocessableEntityException } from '@nestjs/common';

export type NegotiationRole = 'CEO' | 'EXPERT';
export type NegotiationState =
  | 'AWAITING_TECH_REVIEW'
  | 'AWAITING_CEO'
  | 'AWAITING_EXPERT'
  | 'TERMS_ACCEPTED'
  | 'DECLINED';
export type OfferState = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED';

export interface MilestoneOfferCriterion {
  criterion_text: string;
  is_required: boolean;
}

export interface MilestoneOfferTerm {
  milestone_number: number;
  deliverable_statement: string;
  criteria: MilestoneOfferCriterion[];
  price_vnd: number;
  estimated_duration_days?: number;
  condition?: string;
  tech_stack?: string[];
}

export interface BidOffer {
  id: string;
  version: number;
  proposerUserId: string;
  proposerRole: NegotiationRole;
  recipientRole: NegotiationRole;
  milestones: MilestoneOfferTerm[];
  state: OfferState;
  createdAt: string;
  respondedAt?: string;
  technicalScopeVersion: number;
}

export interface BidNegotiationEnvelope {
  formatVersion: 1;
  offers: BidOffer[];
  currentOfferId: string;
  acceptedOfferId?: string;
  acceptedOfferVersion?: number;
  termsAcceptedAt?: string;
  technicalReview: {
    scopeVersion: number;
    status: 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED';
    intendedRecipient: NegotiationRole;
    reviewedAt?: string;
    feedback?: string;
  };
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function positiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeCriteria(value: unknown): MilestoneOfferCriterion[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) {
      return [{ criterion_text: item.trim(), is_required: true }];
    }

    const candidate = record(item);
    const criterionText = nonEmptyString(
      candidate.criterion_text ?? candidate.criterionText ?? candidate.text,
    );
    if (!criterionText) return [];

    return [{
      criterion_text: criterionText,
      is_required:
        typeof (candidate.is_required ?? candidate.isRequired) === 'boolean'
          ? Boolean(candidate.is_required ?? candidate.isRequired)
          : true,
    }];
  });
}

function milestoneNumber(value: UnknownRecord): number | undefined {
  return positiveInteger(value.milestone_number ?? value.milestoneNumber);
}

function throwValidation(error: string, message: string): never {
  throw new UnprocessableEntityException({ error, message });
}

/**
 * Produces the one canonical milestone shape used by offer history, accepted
 * project mirrors, and relational milestone creation. Offered values override
 * the blueprint while missing technical fields inherit from the blueprint.
 */
export function normalizeMilestoneTerms(
  projectFramework: unknown,
  offeredTerms: unknown,
): MilestoneOfferTerm[] {
  if (!Array.isArray(projectFramework) || projectFramework.length === 0) {
    throwValidation('BID_MILESTONE_SCOPE_INCOMPLETE', 'The project has no milestone blueprint.');
  }
  if (!Array.isArray(offeredTerms) || offeredTerms.length === 0) {
    throwValidation('BID_MILESTONE_SET_MISMATCH', 'An offer must include every project milestone.');
  }

  const blueprintByNumber = new Map<number, UnknownRecord>();
  for (const raw of projectFramework) {
    const candidate = record(raw);
    const number = milestoneNumber(candidate);
    if (!number || blueprintByNumber.has(number)) {
      throwValidation(
        'BID_MILESTONE_SCOPE_INCOMPLETE',
        'Project milestone numbers must be unique positive integers.',
      );
    }
    blueprintByNumber.set(number, candidate);
  }

  const offeredByNumber = new Map<number, UnknownRecord>();
  for (const raw of offeredTerms) {
    const candidate = record(raw);
    const number = milestoneNumber(candidate);
    if (!number || offeredByNumber.has(number)) {
      throwValidation(
        'BID_MILESTONE_SET_MISMATCH',
        'Offer milestone numbers must be unique positive integers.',
      );
    }
    offeredByNumber.set(number, candidate);
  }

  const blueprintNumbers = [...blueprintByNumber.keys()].sort((a, b) => a - b);
  const offeredNumbers = [...offeredByNumber.keys()].sort((a, b) => a - b);
  if (
    blueprintNumbers.length !== offeredNumbers.length ||
    blueprintNumbers.some((number, index) => number !== offeredNumbers[index])
  ) {
    throwValidation(
      'BID_MILESTONE_SET_MISMATCH',
      'The offer must contain exactly the project milestone set.',
    );
  }

  return blueprintNumbers.map((number) => {
    const blueprint = blueprintByNumber.get(number)!;
    const offered = offeredByNumber.get(number)!;
    const deliverable = nonEmptyString(
      offered.deliverable_statement ??
        offered.deliverableStatement ??
        blueprint.deliverable_statement ??
        blueprint.deliverableStatement,
    );
    if (!deliverable) {
      throwValidation(
        'BID_MILESTONE_SCOPE_INCOMPLETE',
        `Milestone ${number} requires a deliverable statement.`,
      );
    }

    const price = positiveInteger(
      offered.price_vnd ??
        offered.priceVnd ??
        offered.payment_amount_vnd ??
        offered.paymentAmountVnd,
    );
    if (!price) {
      throwValidation(
        'BID_MILESTONE_PRICE_INVALID',
        `Milestone ${number} requires a positive integer price.`,
      );
    }

    const condition = nonEmptyString(offered.condition ?? blueprint.condition);
    const offeredCriteria = normalizeCriteria(
      offered.criteria ?? offered.acceptance_criteria ?? offered.acceptanceCriteria,
    );
    const blueprintCriteria = normalizeCriteria(
      blueprint.criteria ?? blueprint.acceptance_criteria ?? blueprint.acceptanceCriteria,
    );
    const criteria = offeredCriteria.length > 0 ? offeredCriteria : blueprintCriteria;

    // Legacy project drafts often omitted criteria. Preserve compatibility by
    // promoting the expert's per-milestone delivery condition to a criterion.
    if (criteria.length === 0 && condition) {
      criteria.push({ criterion_text: condition, is_required: true });
    }
    if (criteria.length === 0 || !criteria.some((criterion) => criterion.is_required)) {
      throwValidation(
        'BID_MILESTONE_CRITERIA_REQUIRED',
        `Milestone ${number} requires at least one required acceptance criterion.`,
      );
    }

    const duration = positiveInteger(
      offered.estimated_duration_days ??
        offered.estimatedDurationDays ??
        blueprint.estimated_duration_days ??
        blueprint.estimatedDurationDays,
    );
    const rawTechStack =
      offered.tech_stack ?? offered.techStack ?? blueprint.tech_stack ?? blueprint.techStack;
    const techStack = Array.isArray(rawTechStack)
      ? rawTechStack.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : undefined;

    return {
      milestone_number: number,
      deliverable_statement: deliverable,
      criteria,
      price_vnd: price,
      ...(duration ? { estimated_duration_days: duration } : {}),
      ...(condition ? { condition } : {}),
      ...(techStack && techStack.length > 0 ? { tech_stack: techStack } : {}),
    };
  });
}

export function hasTechnicalScopeChange(
  previous: MilestoneOfferTerm[],
  next: MilestoneOfferTerm[],
): boolean {
  const technicalShape = (terms: MilestoneOfferTerm[]) =>
    terms.map((term) => ({
      milestone_number: term.milestone_number,
      deliverable_statement: term.deliverable_statement,
      criteria: term.criteria,
      tech_stack: term.tech_stack ?? [],
    }));

  return JSON.stringify(technicalShape(previous)) !== JSON.stringify(technicalShape(next));
}

export function isNegotiationEnvelope(value: unknown): value is BidNegotiationEnvelope {
  const candidate = record(value);
  return (
    candidate.formatVersion === 1 &&
    Array.isArray(candidate.offers) &&
    typeof candidate.currentOfferId === 'string' &&
    Boolean(candidate.technicalReview)
  );
}

export function currentOffer(envelope: BidNegotiationEnvelope): BidOffer {
  const offer = envelope.offers.find((candidate) => candidate.id === envelope.currentOfferId);
  if (!offer) {
    throw new UnprocessableEntityException({
      error: 'BID_NEGOTIATION_DATA_INVALID',
      message: 'The current offer is missing from bid history.',
    });
  }
  return offer;
}

export function acceptedOffer(envelope: BidNegotiationEnvelope): BidOffer | undefined {
  return envelope.acceptedOfferId
    ? envelope.offers.find((candidate) => candidate.id === envelope.acceptedOfferId)
    : undefined;
}

export function totalOfferPrice(terms: MilestoneOfferTerm[]): number {
  return terms.reduce((total, term) => total + term.price_vnd, 0);
}

export function deriveNegotiationState(
  envelope: BidNegotiationEnvelope,
  technicalReviewRequired = true,
): { negotiationState: NegotiationState; nextActionBy: NegotiationRole | 'TECH_TEAM' | 'NONE' } {
  const accepted = acceptedOffer(envelope);
  if (accepted) return { negotiationState: 'TERMS_ACCEPTED', nextActionBy: 'NONE' };

  const offer = currentOffer(envelope);
  if (offer.state === 'DECLINED') {
    return { negotiationState: 'DECLINED', nextActionBy: 'NONE' };
  }
  if (envelope.technicalReview.status === 'REVISION_REQUESTED') {
    return {
      negotiationState: 'AWAITING_TECH_REVIEW',
      nextActionBy: offer.proposerRole,
    };
  }
  if (technicalReviewRequired && envelope.technicalReview.status === 'PENDING') {
    return { negotiationState: 'AWAITING_TECH_REVIEW', nextActionBy: 'TECH_TEAM' };
  }
  return offer.recipientRole === 'CEO'
    ? { negotiationState: 'AWAITING_CEO', nextActionBy: 'CEO' }
    : { negotiationState: 'AWAITING_EXPERT', nextActionBy: 'EXPERT' };
}

export function toProjectMilestoneMirror(
  term: MilestoneOfferTerm,
  bidId: string,
  offerVersion: number,
  signOffAuthority: 'CEO' | 'JOINT',
) {
  return {
    milestone_number: term.milestone_number,
    deliverable_statement: term.deliverable_statement,
    criteria: term.criteria,
    payment_amount_vnd: term.price_vnd,
    estimated_cost_vnd: term.price_vnd,
    estimated_duration_days: term.estimated_duration_days,
    condition: term.condition,
    tech_stack: term.tech_stack ?? [],
    sign_off_authority: signOffAuthority,
    accepted_bid_id: bidId,
    accepted_offer_version: offerVersion,
  };
}
