import { IsObject, IsNotEmpty } from 'class-validator';

/**
 * Stage 3 — CEO answers probe questions about scale and infrastructure.
 *
 * probeResponses is a free-form key-value map:
 *   { "What does success look like in 90 days?": "Chatbot correct 90% of the time..." }
 *
 * The probe question strings are defined in the frontend (Stage3Probes.tsx)
 * and sent back as the keys. We store the whole map as stage3_probes_json
 * for Stage 5 synthesis.
 */
export class Stage3Dto {
  @IsObject()
  @IsNotEmpty()
  probeResponses: Record<string, string>;
}
