import type {
  ActiveRole,
  ClientSubtype,
  SubscriptionTier,
  EngagementModel,
  DomainCode,
  DepthLevel,
  VerificationTier,
  SeamCode,
  ArchetypeCode,
  ElicitationState,
  ScenarioType,
  ProjectState,
  ProjectTier,
  EngagementType,
  EngagementState,
  BidState,
  TechStatus,
  CeoStatus,
  MilestoneState,
  SignOffAuthority,
  DodStatus,
  ReleaseState,
  EscrowStatus,
  DisputeState,
  WalletTxType,
  WithdrawalType,
  WithdrawalStatus,
  ServiceState,
  ServiceType,
  PortfolioStatus,
  ReviewerRole,
  DecisionType,
} from "./enums";

import type {
  ArtifactA,
  ArtifactB,
  FootprintAlignment,
  ConditionalPricingItem,
  RequiredSeam,
  RequiredDomain,
  MilestoneFrameworkItem,
  SubmissionFile,
  SeamSignal,
  MatchResult,
  VoidItem,
} from "./jsonb.types";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  taxCode: string | null;
  roles: string[];
  activeRole: ActiveRole;
  clientSubtype: ClientSubtype | null;
  subscriptionTier: SubscriptionTier;
  subscriptionExpires: string | null;
  sepay_bank_account_xid: string | null;
  bank_linked_at: string | null;
  selfTechnical: boolean;
  is_active: boolean;
  activeRoleProfile: ActiveRoleProfile | null;
  createdAt: string;
}

export interface WalletDto {
  id: string;
  userId: string;
  availableBalance: number;
  lockedBalance: number;
}

export interface WalletTransactionDto {
  id: string;
  walletId: string;
  amount: number;
  transactionType: WalletTxType;
  referenceId: string | null;
  createdAt: string;
}

export interface VirtualAccountDto {
  id: string;
  entity_type: string;
  entity_id: string;
  va_number: string;
  fixed_amount: number | null;
  expires_at: string | null;
  status: string;
}

export interface WithdrawalRequestDto {
  id: string;
  expert_id: string;
  type: WithdrawalType;
  amount: number;
  bank_account_xid: string;
  disbursement_id: string | null;
  status: WithdrawalStatus;
  requested_at: string;
  confirmed_at: string | null;
}

export interface ExpertProfileDto {
  userId: string;
  bio: string | null;
  engagementModel: EngagementModel | null;
  stackTagsJson: string[];
  archetypeHistoryJson: object[];
}

export interface ClientProfileDto {
  userId: string;
  companyName: string | null;
  industry: string | null;
  ceoName: string | null;
  isTaxVerified?: boolean;
}

export type ActiveRoleProfile = ExpertProfileDto | ClientProfileDto;

export interface ExpertDomainDepthDto {
  id: string;
  expert_id: string;
  domain_code: DomainCode;
  depth_level: DepthLevel;
  verification_tier: VerificationTier;
}

export interface ExpertSeamClaimDto {
  id: string;
  expert_id: string;
  seam_code: SeamCode;
  verification_tier: VerificationTier;
  submission_count: number;
  locked_until: string | null;
}

export interface ElicitationSessionDto {
  id: string;
  user_id: string;
  current_stage: number;
  archetype: ArchetypeCode | null;
  scenario_type: ScenarioType | null;
  void_list_json: object[];
  state: ElicitationState;
  symptom_text_draft: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDto {
  id: string;
  client_id: string;
  elicitation_session_id: string | null;
  state: ProjectState;
  archetype: ArchetypeCode | null;
  tier: ProjectTier | null;
  selfTechnical: boolean;
  required_seams_json: RequiredSeam[];
  required_domains_json: RequiredDomain[];
  milestone_framework_json: MilestoneFrameworkItem[];
  artifact_a_json: ArtifactA | null;
  projectName?: string | null;
  created_at: string;
}

export interface ServiceDto {
  id: string;
  expert_id: string;
  title: string;
  description: string | null;
  domains_json: DomainCode[];
  seams_json: SeamCode[];
  price_vnd: number;
  state: ServiceState;
  service_type: ServiceType;
}

export interface EngagementDto {
  id: string;
  projectId: string | null;
  expertId: string;
  serviceId: string | null;
  type: EngagementType;
  state: EngagementState;
  connectedAt: string | null;
  clientNdaAcceptedAt: string | null;
  expertNdaAcceptedAt: string | null;
  // Adding supportive fields for EngagementDto
  clientId: string;
  capabilityBid?: CapabilityBidDto | null;
  milestones?: MilestoneDto[];
}

export interface CapabilityBidDto {
  id: string;
  engagementId: string;
  footprintAlignmentJson: FootprintAlignment | null;
  approachSummary: string | null;
  conditionalPricingJson: ConditionalPricingItem[] | null;
  state: BidState;
  techStatus: TechStatus;
  ceoStatus: CeoStatus;
  techFeedback: string | null;
  negotiatedPriceVnd: number | null;
  versionNumber: number;
}

export interface MilestoneDto {
  id: string;
  engagementId: string;
  milestoneNumber: number;
  deliverableStatement: string | null;
  signOffAuthority: SignOffAuthority;
  paymentAmountVnd: number;
  state: MilestoneState;
  vaNumber: string | null;
  vaExpiresAt: string | null;
  fundedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
}

export interface AcceptanceCriterionDto {
  id: string;
  milestoneId: string;
  criterionText: string;
  isRequired: boolean;
  verifiedByRole: SignOffAuthority;
  verifiedAt: string | null;
  revisionNote: string | null;
}

export interface MilestoneDodItemDto {
  id: string;
  milestoneId: string;
  itemDescription: string;
  isRequired: boolean;
  status: DodStatus;
  completedAt: string | null;
  completionNote: string | null;
  notApplicableNote: string | null;
  mapsToCriterionId: string | null;
}

export interface MilestoneSubmissionDto {
  id: string;
  milestoneId: string;
  expertId: string;
  description: string | null;
  filesJson: SubmissionFile[];
  submittedAt: string;
}

export interface PaygatedDocumentDto {
  id: string;
  milestoneId: string;
  documentUrl: string;
  releaseState: ReleaseState;
  stagedAt: string;
  releasedAt: string | null;
}

// ── Escrow & Disputes ─────────────────────────────────────────────────────────
export interface EscrowAccountDto {
  id: string;
  milestone_id: string | null;
  engagement_id: string | null;
  amount: number;
  client_wallet_id: string;
  expert_wallet_id: string;
  status: EscrowStatus;
  held_at: string;
  released_at: string | null;
}

export interface DisputeDto {
  id: string;
  engagement_id: string;
  milestone_id: string | null;
  criterion_id: string;
  escrow_account_id: string;
  filed_by: string;
  state: DisputeState;
  llm_confidence: number | null;
  filed_at: string;
  resolved_at: string | null;
}

export interface MessageDto {
  id: string;
  engagement_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  timestamp: string;
  is_read: boolean; // computed for current user
}

export interface ReviewDto {
  id: string;
  engagement_id: string;
  reviewer_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
  structured_signals_json: SeamSignal[] | null;
  reviewer_role: ReviewerRole;
}

export interface ShortlistDto {
  project_id: string;
  results: MatchResult[];
  generated_at: string;
}

export interface PortfolioSubmissionDetailDto {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  llmConfidence: number | null;
  evaluatedAt: string | null;
  advisoryNote: string | null;
  attemptsRemaining?: number;
  lockedUntil: string | null;
  evaluationTierUpgraded?: boolean;
}

export interface PortfolioListItemDto {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  llmConfidence: number | null;
  evaluatedAt: string | null;
  advisoryNote: string | null;
  createdAt: string;
  seamClaim: {
    id: string;
    seamCode: string;
    verificationTier: string;
    submissionCount: number;
  };
}

export interface PlatformDecisionDto {
  id: string;
  decision_type: DecisionType;
  entity_type: string | null;
  entity_id: string | null;
  llm_confidence: number | null;
  decision: string | null;
  advisory_note: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface GenerateHandoffLinkResponse {
  invite_token: string;
  invite_link: string;
  expires_in: string;
}

export interface ApiError {
  statusCode: number;
  message: string | object;
  path: string;
  timestamp: string;
}

// ── Bids API DTOs (from use-bids.ts) ──────────────────────────────────────────

/**
 * Payload used for creating a new capability bid.
 * Used in: frontend/src/hooks/use-bids.ts (useCreateBid)
 */
export interface CreateBidPayLoad {
  projectId: string;
  footprint_alignment_json: FootprintAlignment;
  approach_summary: string;
  conditional_pricing_json: ConditionalPricingItem[];
}

/**
 * Data transfer object for updating an existing bid.
 * Used in: frontend/src/hooks/use-bids.ts (useUpdateBid)
 */
export interface UpdateBidDto {
  footprint_alignment_json: FootprintAlignment;
  approach_summary: string;
  conditional_pricing_json: ConditionalPricingItem[];
}

/**
 * Variables required when calling the update bid mutation.
 * Used in: frontend/src/hooks/use-bids.ts (useUpdateBid)
 */
export interface UpdateBidVariables {
  bidId: string; // param
  body: UpdateBidDto;
}

/**
 * Data transfer object for the technical review of a bid.
 * Used in: frontend/src/hooks/use-bids.ts (useTechReview)
 */
export interface TechReviewDto {
  action: "APPROVED" | "REVISION_REQUESTED";
  tech_feedback?: string;
}

/**
 * Variables required when calling the tech review mutation.
 * Used in: frontend/src/hooks/use-bids.ts (useTechReview)
 */
export interface TechReviewVariables {
  bidId: string;
  body: TechReviewDto;
}

/**
 * Data transfer object for the CEO's decision on a bid.
 * Used in: frontend/src/hooks/use-bids.ts (useCeoDecision)
 */
export interface CeoDecisionDto {
  decision: "APPROVED" | "DECLINED";
}

/**
 * Variables required when calling the CEO decision mutation.
 * Used in: frontend/src/hooks/use-bids.ts (useCeoDecision)
 */
export interface CeoDecisionVariables {
  bidId: string;
  body: CeoDecisionDto;
}

/**
 * Data transfer object for making a counter-offer on a bid.
 * Used in: frontend/src/hooks/use-bids.ts (useCounterOffer)
 */
export interface CounterOfferDto {
  negotiated_price_vnd: number;
}

/**
 * Variables required when calling the counter-offer mutation.
 * Used in: frontend/src/hooks/use-bids.ts (useCounterOffer)
 */
export interface CounterOfferVariables {
  bidId: string;
  body: CounterOfferDto;
}

// ── Elicitation API DTOs (from use-elicitation.ts) ──────────────────────────

/**
 * Represents a successful elicitation gate passage.
 * Used in: frontend/src/hooks/use-elicitation.ts (GateResult)
 */
export interface GatePassed {
  gate_passed: true;
  completeness_score: number;
  project_id: string;
}

/**
 * Represents a failed elicitation gate attempt.
 * Used in: frontend/src/hooks/use-elicitation.ts (GateResult)
 */
export interface GateFailed {
  gate_passed: false;
  completeness_score: number;
  flagged_void: string | null;
  return_to_stage: number;
  advisory_note: string;
}

/**
 * Union type representing the result of an elicitation gate.
 * Used in: frontend/src/hooks/use-elicitation.ts
 */
export type GateResult = GatePassed | GateFailed;

/**
 * Data representation of a completed elicitation stage.
 * Used in: frontend/src/hooks/use-elicitation.ts
 */
export interface StageCompleteData {
  voidListJson?: VoidItem[];
  archetype?: string;
  probeResponses?: Record<string, string>;
  gateResult?: GateResult;
  symptomText?: string;
  acknowledgedVoidCodes?: string[];
  techContext?: {
    scaleAndInfrastructure: string;
    integrationMethod: string;
    legacyVolume: string;
    schemas: string[];
    contracts: string[];
  };
}

// ── Milestones API DTOs (from use-milestones.ts) ──────────────────────────

/**
 * Payload used for creating a new milestone.
 * Used in: frontend/src/hooks/use-milestones.ts (useCreateMilestone)
 */
export interface CreateMilestonePayload {
  engagement_id: string;
  milestone_number: number;
  deliverable_statement: string;
  sign_off_authority: SignOffAuthority;
  payment_amount_vnd: number;
  criteria: CreateCriterionDto[];
}

/**
 * Data transfer object representing a criterion when creating a milestone.
 * Used in: frontend/src/hooks/use-milestones.ts
 */
export interface CreateCriterionDto {
  criterion_text: string;
  is_required?: boolean;
}

// ── Criteria API DTOs (from use-criteria.ts) ──────────────────────────────

/**
 * Payload used for verifying a criterion.
 * Used in: frontend/src/hooks/use-criteria.ts (useVerifyCriterion)
 */
export interface VerifyCriterionDto {
  verification_comment?: string;
}

/**
 * Variables required when calling the verify criterion mutation.
 * Used in: frontend/src/hooks/use-criteria.ts (useVerifyCriterion)
 */
export interface VerifyCriterionVariable {
  criterionId: string;
  body: VerifyCriterionDto;
}

/**
 * Payload used for requesting revision on a criterion.
 * Used in: frontend/src/hooks/use-criteria.ts (useRequestRevision)
 */
export interface RevisionNoteDto {
  revision_note: string;
}

/**
 * Variables required when calling the request revision mutation.
 * Used in: frontend/src/hooks/use-criteria.ts (useRequestRevision)
 */
export interface RevisionNoteVariable {
  criterionId: string;
  body: RevisionNoteDto;
}

// ── DoD API DTOs (from use-dod.ts) ──────────────────────────────────────────

/**
 * Payload used for creating a new DoD checklist item.
 * Used in: frontend/src/hooks/use-dod.ts (useCreateDodItem)
 */
export interface CreateDodItemDto {
  item_description: string;
  is_required?: boolean;
  maps_to_criterion_id?: string;
}

/**
 * Variables required when calling the create DoD item mutation.
 * Used in: frontend/src/hooks/use-dod.ts (useCreateDodItem)
 */
export interface CreateDodItemVariable {
  milestoneId: string;
  body: CreateDodItemDto;
}

/**
 * Payload used for updating a Milestone DoD item status.
 * Used in: frontend/src/hooks/use-dod.ts (useUpdateDodStatus)
 */
export interface UpdateMilestoneDoDItemDto {
  status: DodStatus;
  completion_note?: string;
  not_applicable_note?: string;
}

/**
 * Variables required when calling the update DoD status mutation.
 * Used in: frontend/src/hooks/use-dod.ts (useUpdateDodStatus)
 */
export interface UpdateMilestoneDoDItemVariable {
  milestoneId: string;
  itemId: string;
  body: UpdateMilestoneDoDItemDto;
}

// ── Submissions API DTOs (from use-submissions.ts) ──────────────────────────

/**
 * Payload used for expert submitting deliverables for a milestone.
 * Used in: frontend/src/hooks/use-submissions.ts (useSubmitMilestone)
 */
export interface CreateSubmissionDto {
  description: string;
  files_json?: string[];
}

/**
 * Variables required when calling the submit milestone mutation.
 * Used in: frontend/src/hooks/use-submissions.ts (useSubmitMilestone)
 */
export interface CreateSubmissionVariable {
  milestoneId: string;
  body: CreateSubmissionDto;
}

/**
 * Payload used for staging a detailed technical paygated document.
 * Used in: frontend/src/hooks/use-submissions.ts (useUploadDocument)
 */
export interface StagePaygatedDocDto {
  document_url: string;
}

/**
 * Variables required when calling the upload document mutation.
 * Used in: frontend/src/hooks/use-submissions.ts (useUploadDocument)
 */
export interface StagePaygatedDocVariable {
  milestoneId: string;
  body: StagePaygatedDocDto;
}

// ── Admin Config Types ───────────────────────────────────────────────────────

export interface SubPackage {
  id: string;
  role: string;
  name: string;
  priceVnd: number;
  durationMonths: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DomainDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface SeamDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ArchetypeDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ProbeQuestion {
  id: string;
  archetypeCode: string;
  questionText: string;
  displayOrder: number;
  isActive: boolean;
}

// ── Invitations ───────────────────────────────────────────────────────────────
export interface InvitationDto {
  id:          string;
  projectId:   string;
  expertId:    string;
  ceoId:       string;
  message:     string | null;
  status:      'PENDING' | 'ACCEPTED' | 'DECLINED';
  invitedAt:   string;
  respondedAt: string | null;
  expiresAt:   string | null;
  isExpired:   boolean;
  project: {
    id:                  string;
    projectName:         string;
    state:               string;
    archetype:           string;
    tier:                string;
    createdAt:           string;
    requiredDomainsJson: any[];
    requiredSeamsJson:   any[];
  };
  ceo: {
    id:       string;
    fullName: string;
  };
}

export interface MilestoneDetailDto extends MilestoneDto {
  acceptanceCriteria: AcceptanceCriterionDto[];
  dodItems: MilestoneDodItemDto[];
}
