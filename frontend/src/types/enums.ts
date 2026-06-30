export type ActiveRole   = 'CLIENT' | 'EXPERT' | 'ADMIN';
export type UserRoleItem = 'CLIENT_CEO' | 'EXPERT'
export type ClientSubtype = 'CEO' | 'TECH_TEAM';
export type SubscriptionTier = 'free' | 'pro';

export enum SubscriptionPrice {
  CEO = 5000,
  EXPERT = 3000,
}

export type EngagementModel  = 'MILESTONE' | 'HOURLY' | 'HYBRID';

export type DomainCode =
  | 'A'   // LLM Application Engineering
  | 'B'   // MLOps / LLMOps
  | 'C'   // AI Evaluation & Quality
  | 'D'   // Vector DB & Embeddings
  | 'E'   // Data & Pipeline Engineering
  | 'F';  // ML Modeling & Fine-Tuning

export type DepthLevel       = 'SURFACE' | 'OPERATIONAL' | 'DEEP';
export type VerificationTier = 'CLAIMED' | 'EVIDENCE_BACKED';

export type SeamCode =
  | 'A↔C' | 'A↔F' | 'A↔D'
  | 'D↔E' | 'D↔F' | 'C↔F'
  | 'E↔F' | 'A↔B' | 'B↔E' | 'C↔E';

export type SeamCriticality = 'load_bearing' | 'significant' | 'contributing';

export type ArchetypeCode    = '1' | '2' | '3' | '4' | '5' | '6';
export type ScenarioType     = 'STANDARD' | 'SCENARIO_A' | 'SCENARIO_B';
export type ElicitationState = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'RETURNED';

export type ProjectState  = 'DRAFT' | 'PUBLISHED' | 'RETURNED_TO_CLIENT' | 'SUSPENDED';
export type ProjectTier   = 'TIER_1' | 'TIER_2' | 'TIER_3';

export type ServiceState = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED';
export type ServiceType  = 'AI_SERVICE' | 'TECH_DISCOVERY';

export type EngagementType  = 'PROJECT_BASED' | 'SERVICE_PURCHASE' | 'TECH_DISCOVERY';
export type EngagementState = 'PENDING' | 'CONNECTED' | 'ACTIVE' | 'CLOSED' | 'DISPUTED';

export type BidState =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'TECH_REVIEW'
  | 'REVISION_REQUESTED'
  | 'TECH_APPROVED'
  | 'CEO_REVIEW'
  | 'SELECTED'
  | 'DECLINED';

export type TechStatus = 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED';
export type CeoStatus  = 'PENDING' | 'APPROVED' | 'DECLINED';

export type MilestoneState =
  | 'DEFINED'
  | 'AWAITING_PAYMENT'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'IN_REVISION'
  | 'APPROVED'
  | 'RELEASED'
  | 'DISPUTED';

export type SignOffAuthority = 'TECH_TEAM' | 'CEO' | 'JOINT';
export type DodStatus        = 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE';
export type ReleaseState     = 'STAGED' | 'RELEASED';

export type EscrowStatus = 'HELD' | 'RELEASED' | 'FROZEN' | 'REFUNDED' | 'SPLIT';
export type DisputeState =
  | 'PENDING'
  | 'LAYER_1_EVAL'
  | 'AUTO_RESOLVED'
  | 'MANUAL_REVIEW'
  | 'RESOLVED';

export type WalletTxType =
  | 'TOP_UP'
  | 'SUBSCRIPTION'
  | 'ESCROW_LOCK'
  | 'ESCROW_RELEASE'
  | 'PLATFORM_FEE'
  | 'ESCROW_REFUND'
  | 'ESCROW_SPLIT'
  | 'WITHDRAWAL';

export type VirtualAccountEntityType = 'WALLET_TOPUP' | 'MILESTONE' | 'SERVICE';
export type VirtualAccountStatus     = 'ACTIVE' | 'EXPIRED' | 'USED';
export type WithdrawalType           = 'MILESTONE_RELEASE' | 'EXPERT_MANUAL';
export type WithdrawalStatus         = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type PortfolioStatus  = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ReviewerRole     = 'CEO' | 'TECH_TEAM' | 'EXPERT';
export type DecisionType =
  | 'ELICITATION_SYNTHESIS'
  | 'SPEC_AUTO_RETURN'
  | 'SEAM_TIER_UPGRADE'
  | 'PORTFOLIO_EVAL'
  | 'DISPUTE_L1_EVAL'
  | 'CRITERION_QUALITY_GATE';
