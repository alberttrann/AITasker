import type {
  ArchetypeCode, DomainCode, DepthLevel, ProjectTier,
  SeamCode, SeamCriticality, SignOffAuthority, VerificationTier,
} from './enums';

// e.g. ["CLIENT", "EXPERT"]
export type UserRoles = string[];

export interface VoidItem {
  void_code: string;
  severity:  'HIGH' | 'MEDIUM' | 'LOW';
  injected:  boolean;  // true = CEO acknowledged and it's baked into milestone framework
}

export interface RequiredSeam {
  seam_code:    SeamCode;
  criticality:  SeamCriticality;
}

export interface RequiredDomain {
  domain_code:     DomainCode;
  required_depth:  DepthLevel;
}

export interface MilestoneFrameworkItem {
  milestone_number:      number;
  deliverable_statement: string;
  sign_off_authority:    SignOffAuthority;
  payment_amount_vnd:    number;
}

export interface ArtifactA {
  business_intent: string;
  archetype:       ArchetypeCode;
  stack_tags:      string[];
  volume_tier:     ProjectTier;
  sdlc_notices:    string[];
}

export interface ArtifactB {
  stack_tags:         string[];
  integration_method: string;
  legacy_volume:      string;
  schemas:            string[];  // URLs
  contracts:          string[];  // URLs
}

export type StackTags = string[];

export interface ArchetypeHistoryItem {
  archetype_code:  ArchetypeCode;
  tier:            ProjectTier;
  self_declared:   boolean;
}

export type ServiceDomains = DomainCode[];
export type ServiceSeams   = SeamCode[];

export interface FootprintAlignment {
  domains: Array<{ code: DomainCode; depth: DepthLevel }>;
  seams:   Array<{ code: SeamCode;   tier: VerificationTier }>;
}

export interface ConditionalPricingItem {
  milestone_number: number;
  price_vnd:        number;
  condition:        string | null;
}

export interface SubmissionFile {
  url:       string;
  filename:  string;
  mime_type: string;
}

export interface SeamSignal {
  seam_code:   SeamCode;
  signal_type: SeamCriticality;
  seam_role:   string;
}

export interface GapMapItem {
  seam_code: SeamCode;
  color:     'green' | 'amber' | 'red';
}

export interface MatchResult {
  expert_id:       string;
  composite_score: number;
  strength_label:  string;
  gap_map:         GapMapItem[];
}