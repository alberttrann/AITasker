export interface DisputeResolution {
  decision: 'EXPERT_WINS' | 'CLIENT_WINS' | 'SPLIT';
}

export interface ResolutionContext {
  source: 'AI' | 'ADMIN';
  llmConfidence?: number;
  llmReasoning?: string;
  resolvedBy?: string;
}
