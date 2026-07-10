export enum DisputeState {
  PENDING = 'PENDING', // transient — exists only until LAYER_1_EVAL kicks off synchronously in the same request
  LAYER_1_EVAL = 'LAYER_1_EVAL', // AI evaluation in flight
  AUTO_RESOLVED = 'AUTO_RESOLVED', // confidence >= 0.80, resolved automatically
  MANUAL_REVIEW = 'MANUAL_REVIEW', // confidence < 0.80, awaiting admin
  RESOLVED = 'RESOLVED', // admin resolved via dashboard button
}
