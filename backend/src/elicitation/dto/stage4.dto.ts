import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Stage 4 — Technical context filled by the CEO directly (Scenario A).
 * Also used when TECH_TEAM submits via the handoff route.
 *
 * These three fields map directly to the Stage5Request.stage4_tech_inputs
 * object sent to ai-service synthesis.
 */
export class Stage4Dto {
  @IsString()
  @IsNotEmpty()
  current_stack: string;         // e.g. "Python FastAPI, PostgreSQL, AWS ECS"

  @IsString()
  @IsNotEmpty()
  data_available: string;        // e.g. "200k Zendesk conversation logs"

  @IsString()
  @IsOptional()
  latency_requirement?: string;  // e.g. "< 3 seconds end-to-end"
}