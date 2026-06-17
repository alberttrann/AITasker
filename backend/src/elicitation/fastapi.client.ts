import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Request / Response interfaces
// in sync with ai-service TECHNICAL_DOC.md.

export interface Stage1Request {
  symptom_text: string;
}

export interface VoidItem {
  void_code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Stage1Response {
  symptoms: string[];
  scale_signals: Record<string, string | null>;
  voids: VoidItem[];
}

export interface Stage5Request {
  session_id:          string;
  stage1_symptoms:     string[];
  stage2_archetype:    string;
  stage3_probes:       Record<string, unknown>;
  stage4_tech_inputs:  Record<string, unknown>;
  void_list_json:      Array<Record<string, unknown>>;
}

export interface Stage5Response {
  required_seams_json:      Array<Record<string, unknown>>;
  required_domains_json:    Array<Record<string, unknown>>;
  milestone_framework_json: Array<Record<string, unknown>>;
  artifact_a_json:          Record<string, unknown>;
  artifact_b_json:          Record<string, unknown>;
  completeness_score:       number;
}

export interface PortfolioEvalRequest {
  seam_code:           string;
  project_description: string;
  decision_points:     string;
}

export interface PortfolioEvalResponse {
  confidence_score: number;
  passed_boolean:   boolean;
  gap_advisory:     string | null;
}

export interface MatchingRequest {
  required_seams_json:   Array<Record<string, unknown>>;
  required_domains_json: Array<Record<string, unknown>>;
  expert_profiles:       Array<Record<string, unknown>>;
  project_archetype?:    string;
}

export interface GapMapItem {
  seam_code: string;
  color:     'green' | 'amber' | 'red';
}

export interface MatchResult {
  expert_id:       string;
  composite_score: number;
  strength_label:  'STRONG_MATCH' | 'GOOD_MATCH' | 'POSSIBLE_MATCH' | 'WEAK_MATCH';
  gap_map:         GapMapItem[];
}

export interface DisputeEvalRequest {
  criterion_text:          string;
  deliverable_description: string;
  files?:                  string[];
}

export interface DisputeEvalResponse {
  confidence_score: number;
  finding:          'expert_wins' | 'client_wins';
}

export interface CriterionCheckRequest {
  criterion_text: string;
}

export interface CriterionCheckResponse {
  is_subjective: boolean;
  suggestions:   string[];
}

export interface ServiceGenerateRequest {
  expert_capabilities: string[];
  target_use_cases:    string[];
}

export interface ServiceGenerateResponse {
  title:               string;
  description:         string;
  scope:               string;
  timeline:            string;
  suggested_price_vnd: number;
}

// Per-endpoint timeout constants (ms)
// Sourced from ai-service TECHNICAL_DOC.md §7 "Timeout recommendations".
const TIMEOUT_DEFAULT   = 30_000;  //  30s — criterion, portfolio, dispute, stage1
const TIMEOUT_STAGE5    = 90_000;  //  90s — stage5 synthesis (large structured output)
const TIMEOUT_MATCHING  =  5_000;  //   5s — pure arithmetic, no LLM

@Injectable()
export class FastapiClient {
  private readonly http: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseUrl =
      configService.get<string>('fastapi.url') ?? 'http://localhost:8000';

    this.http = axios.create({
      baseURL: this.normalizeBaseUrl(baseUrl),
      timeout: TIMEOUT_DEFAULT,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Elicitation

  async stage1Extract(payload: Stage1Request): Promise<Stage1Response> {
    return this.post<Stage1Response>('/llm/elicitation/stage1-extract', payload);
  }

  // FIX (blocking): stage5-synthesize can take up to 90s for complex sessions
  // (5 structured JSON outputs, large context). Override the 30s default timeout.
  async stage5Synthesize(payload: Stage5Request): Promise<Stage5Response> {
    return this.post<Stage5Response>(
      '/llm/elicitation/stage5-synthesize',
      payload,
      { timeout: TIMEOUT_STAGE5 },
    );
  }

  // Other LLM endpoints

  async portfolioEval(payload: PortfolioEvalRequest): Promise<PortfolioEvalResponse> {
    return this.post<PortfolioEvalResponse>('/llm/portfolio-eval', payload);
  }

  async criterionCheck(payload: CriterionCheckRequest): Promise<CriterionCheckResponse> {
    return this.post<CriterionCheckResponse>('/llm/criterion-check', payload);
  }

  async disputeEval(payload: DisputeEvalRequest): Promise<DisputeEvalResponse> {
    return this.post<DisputeEvalResponse>('/llm/dispute-eval', payload);
  }

  async serviceGenerate(payload: ServiceGenerateRequest): Promise<ServiceGenerateResponse> {
    return this.post<ServiceGenerateResponse>('/llm/service-generate', payload);
  }

  // Matching is pure arithmetic — no LLM. Short timeout is fine.
  async matching(payload: MatchingRequest): Promise<MatchResult[]> {
    return this.post<MatchResult[]>('/llm/matching', payload, {
      timeout: TIMEOUT_MATCHING,
    });
  }

  // Internal helpers

  private async post<TResponse>(
    path:    string,
    payload: unknown,
    config?: AxiosRequestConfig,
  ): Promise<TResponse> {
    const response: AxiosResponse<TResponse> = await this.http.post(
      path,
      payload,
      config,
    );
    return response.data;
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, '');
  }
}
