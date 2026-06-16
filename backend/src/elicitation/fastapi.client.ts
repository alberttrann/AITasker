import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface Stage1Request {
  symptom_text: string;
}

export interface VoidItem {
  void_code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | string;
}

export interface Stage1Response {
  symptoms: string[];
  scale_signals: Record<string, unknown>;
  voids: VoidItem[];
}

export interface Stage5Request {
  session_id: string;
  stage1_symptoms: string[];
  stage2_archetype: string;
  stage3_probes: Record<string, unknown>;
  stage4_tech_inputs: Record<string, unknown>;
  void_list_json: Array<Record<string, unknown>>;
}

export interface Stage5Response {
  required_seams_json: Array<Record<string, unknown>>;
  required_domains_json: Array<Record<string, unknown>>;
  milestone_framework_json: Array<Record<string, unknown>>;
  artifact_a_json: Record<string, unknown>;
  artifact_b_json: Record<string, unknown>;
  completeness_score: number;
}

export interface PortfolioEvalRequest {
  project_description: string;
  decision_points: string;
  seam_code: string;
}

export interface PortfolioEvalResponse {
  confidence_score: number;
  passed_boolean: boolean;
  gap_advisory?: string | null;
}

export interface MatchingRequest {
  required_seams_json: Array<Record<string, unknown>>;
  required_domains_json: Array<Record<string, unknown>>;
  expert_profiles: Array<Record<string, unknown>>;
  project_archetype?: string;
}

export interface GapMapItem {
  seam_code: string;
  color: string;
}

export interface MatchResult {
  expert_id: string;
  composite_score: number;
  strength_label: string;
  gap_map: GapMapItem[];
}

export interface DisputeEvalRequest {
  criterion_text: string;
  deliverable_description: string;
  files?: string[];
}

export interface DisputeEvalResponse {
  confidence_score: number;
  finding: 'expert_wins' | 'client_wins' | string;
}

export interface CriterionCheckRequest {
  criterion_text: string;
}

export interface CriterionCheckResponse {
  is_subjective: boolean;
  suggestions: string[];
}

export interface ServiceGenerateRequest {
  expert_capabilities: string[];
  target_use_cases: string[];
}

export interface ServiceGenerateResponse {
  title: string;
  description: string;
  scope: string;
  timeline: string;
  suggested_price_vnd: number;
}

@Injectable()
export class FastapiClient {
  private readonly http: AxiosInstance;

  constructor(configService: ConfigService) {
    const baseUrl = configService.get<string>('fastapi.url') || 'http://localhost:8000';

    this.http = axios.create({
      baseURL: this.normalizeBaseUrl(baseUrl),
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async stage1Extract(payload: Stage1Request): Promise<Stage1Response> {
    return this.post<Stage1Response>('/llm/elicitation/stage1-extract', payload);
  }

  async stage5Synthesize(payload: Stage5Request): Promise<Stage5Response> {
    return this.post<Stage5Response>('/llm/elicitation/stage5-synthesize', payload);
  }

  async portfolioEval(payload: PortfolioEvalRequest): Promise<PortfolioEvalResponse> {
    return this.post<PortfolioEvalResponse>('/llm/portfolio-eval', payload);
  }

  async matching(payload: MatchingRequest): Promise<MatchResult[]> {
    return this.post<MatchResult[]>('/llm/matching', payload);
  }

  async disputeEval(payload: DisputeEvalRequest): Promise<DisputeEvalResponse> {
    return this.post<DisputeEvalResponse>('/llm/dispute-eval', payload);
  }

  async criterionCheck(payload: CriterionCheckRequest): Promise<CriterionCheckResponse> {
    return this.post<CriterionCheckResponse>('/llm/criterion-check', payload);
  }

  async serviceGenerate(payload: ServiceGenerateRequest): Promise<ServiceGenerateResponse> {
    return this.post<ServiceGenerateResponse>('/llm/service-generate', payload);
  }

  private async post<TResponse>(path: string, payload: unknown): Promise<TResponse> {
    const response: AxiosResponse<TResponse> = await this.http.post(path, payload);
    return response.data;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }
}
