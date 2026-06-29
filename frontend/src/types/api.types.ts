import type {
  ActiveRole, ClientSubtype, SubscriptionTier, EngagementModel,
  DomainCode, DepthLevel, VerificationTier, SeamCode,
  ArchetypeCode, ElicitationState, ScenarioType,
  ProjectState, ProjectTier, EngagementType, EngagementState,
  BidState, TechStatus, CeoStatus,
  MilestoneState, SignOffAuthority, DodStatus, ReleaseState,
  EscrowStatus, DisputeState, WalletTxType, WithdrawalType,
  WithdrawalStatus, ServiceState, ServiceType, PortfolioStatus,
  ReviewerRole, DecisionType,
} from './enums';

import type {
  ArtifactA, ArtifactB, FootprintAlignment, ConditionalPricingItem,
  RequiredSeam, RequiredDomain, MilestoneFrameworkItem,
  SubmissionFile, SeamSignal, MatchResult,
} from './jsonb.types';

export interface AuthTokens {
  access_token:  string;
  refresh_token: string;
}

export interface UserDto {
  id:                       string;
  email:                    string;
  fullName:                string;
  phone:                    string | null;
  taxCode:                  string | null;
  roles:                    string[];
  activeRole:              ActiveRole;
  clientSubtype:           ClientSubtype | null;
  subscriptionTier:        SubscriptionTier;
  subscriptionExpires:     string | null;
  sepay_bank_account_xid:   string | null;
  bank_linked_at:           string | null;
  self_technical:           boolean;
  is_active:                boolean;
  activeRoleProfile:       ActiveRoleProfile | null;
  createdAt:               string;
}

export interface WalletDto {
  id:                string;
  userId:           string;
  availableBalance: number;
  lockedBalance:    number;
}

export interface WalletTransactionDto {
  id:               string;
  walletId:        string;
  amount:           number;
  transactionType: WalletTxType;
  referenceId:     string | null;
  createdAt:       string;
}

export interface VirtualAccountDto {
  id:           string;
  entity_type:  string;
  entity_id:    string;
  va_number:    string;
  fixed_amount: number | null;
  expires_at:   string | null;
  status:       string;
}

export interface WithdrawalRequestDto {
  id:                string;
  expert_id:         string;
  type:              WithdrawalType;
  amount:            number;
  bank_account_xid:  string;
  disbursement_id:   string | null;
  status:            WithdrawalStatus;
  requested_at:      string;
  confirmed_at:      string | null;
}

export interface ExpertProfileDto {
  userId:                string;
  bio:                    string | null;
  engagementModel:       EngagementModel | null;
  stackTagsJson:         string[];
  archetypeHistoryJson:  object[];
}

export interface ClientProfileDto {
  userId:       string;
  companyName:  string | null;
  industry:     string | null;
  ceoName:      string | null;
  isTaxVerified?: boolean;
}

export type ActiveRoleProfile = ExpertProfileDto | ClientProfileDto;

export interface ExpertDomainDepthDto {
  id:                string;
  expert_id:         string;
  domain_code:       DomainCode;
  depth_level:       DepthLevel;
  verification_tier: VerificationTier;
}

export interface ExpertSeamClaimDto {
  id:                string;
  expert_id:         string;
  seam_code:         SeamCode;
  verification_tier: VerificationTier;
  submission_count:  number;
  locked_until:      string | null;
}

export interface ElicitationSessionDto {
  id:            string;
  user_id:       string;
  current_stage: number;
  archetype:     ArchetypeCode | null;
  scenario_type: ScenarioType | null;
  void_list_json: object[];
  state:         ElicitationState;
  created_at:    string;
  updated_at:    string;
}

export interface ProjectDto {
  id:                        string;
  client_id:                 string;
  elicitation_session_id:    string | null;
  state:                     ProjectState;
  archetype:                 ArchetypeCode | null;
  tier:                      ProjectTier | null;
  self_technical:            boolean;
  required_seams_json:       RequiredSeam[];
  required_domains_json:     RequiredDomain[];
  milestone_framework_json:  MilestoneFrameworkItem[];
  artifact_a_json:           ArtifactA | null;
  created_at:                string;
}

export interface ServiceDto {
  id:           string;
  expert_id:    string;
  title:        string;
  description:  string | null;
  domains_json: DomainCode[];
  seams_json:   SeamCode[];
  price_vnd:    number;
  state:        ServiceState;
  service_type: ServiceType;
}

export interface EngagementDto {
  id:                     string;
  project_id:             string | null;
  expert_id:              string;
  service_id:             string | null;
  type:                   EngagementType;
  state:                  EngagementState;
  connected_at:           string | null;
  client_nda_accepted_at: string | null;
  expert_nda_accepted_at: string | null;
}

export interface CapabilityBidDto {
  id:                        string;
  engagement_id:             string;
  footprint_alignment_json:  FootprintAlignment | null;
  approach_summary:          string | null;
  conditional_pricing_json:  ConditionalPricingItem[] | null;
  state:                     BidState;
  tech_status:               TechStatus;
  ceo_status:                CeoStatus;
  tech_feedback:             string | null;
  negotiated_price_vnd:      number | null;
  version_number:            number;
}

export interface MilestoneDto {
  id:                    string;
  engagement_id:         string;
  milestone_number:      number;
  deliverable_statement: string | null;
  sign_off_authority:    SignOffAuthority;
  payment_amount_vnd:    number;
  state:                 MilestoneState;
  va_number:             string | null;
  va_expires_at:         string | null;
  funded_at:             string | null;
  submitted_at:          string | null;
  approved_at:           string | null;
  released_at:           string | null;
}

export interface AcceptanceCriterionDto {
  id:              string;
  milestone_id:    string;
  criterion_text:  string;
  is_required:     boolean;
  verified_by_role: SignOffAuthority;
  verified_at:     string | null;
  revision_note:   string | null;
}

export interface MilestoneDodItemDto {
  id:                  string;
  milestone_id:        string;
  item_description:    string;
  is_required:         boolean;
  status:              DodStatus;
  completed_at:        string | null;
  completion_note:     string | null;
  not_applicable_note: string | null;
  maps_to_criterion_id: string | null;
}

export interface MilestoneSubmissionDto {
  id:           string;
  milestone_id: string;
  expert_id:    string;
  description:  string | null;
  files_json:   SubmissionFile[];
  submitted_at: string;
}

export interface PaygatedDocumentDto {
  id:            string;
  milestone_id:  string;
  document_url:  string;
  release_state: ReleaseState;
  staged_at:     string;
  released_at:   string | null;
}

// ── Escrow & Disputes ─────────────────────────────────────────────────────────
export interface EscrowAccountDto {
  id:               string;
  milestone_id:     string | null;
  engagement_id:    string | null;
  amount:           number;
  client_wallet_id: string;
  expert_wallet_id: string;
  status:           EscrowStatus;
  held_at:          string;
  released_at:      string | null;
}

export interface DisputeDto {
  id:               string;
  engagement_id:    string;
  milestone_id:     string | null;
  criterion_id:     string;
  escrow_account_id: string;
  filed_by:         string;
  state:            DisputeState;
  llm_confidence:   number | null;
  filed_at:         string;
  resolved_at:      string | null;
}

export interface MessageDto {
  id:             string;
  engagement_id:  string;
  sender_id:      string;
  content:        string;
  attachment_url: string | null;
  timestamp:      string;
  is_read:        boolean;  // computed for current user
}

export interface ReviewDto {
  id:                     string;
  engagement_id:          string;
  reviewer_id:            string;
  target_id:              string;
  rating:                 number;
  comment:                string | null;
  structured_signals_json: SeamSignal[] | null;
  reviewer_role:          ReviewerRole;
}

export interface ShortlistDto {
  project_id: string;
  results:    MatchResult[];
  generated_at: string;
}

export interface PlatformDecisionDto {
  id:             string;
  decision_type:  DecisionType;
  entity_type:    string | null;
  entity_id:      string | null;
  llm_confidence: number | null;
  decision:       string | null;
  advisory_note:  string | null;
  created_at:     string;
}

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

export interface GenerateHandoffLinkResponse {
  invite_token: string;
  invite_link: string;
  expires_in: string;
}

export interface ApiError {
  statusCode: number;
  message:    string | object;
  path:       string;
  timestamp:  string;
}