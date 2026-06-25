export interface DisputeResolution {
  decision: 'EXPERT_WINS' | 'CLIENT_WINS' | 'SPLIT';
  expertSharePercent?: number; // required only when decision === 'SPLIT'
}