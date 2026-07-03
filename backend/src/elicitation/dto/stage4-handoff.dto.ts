import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Stage 4 submitted by the TECH_TEAM member via the handoff invite link.
 * Same payload shape as Stage4Dto — the different route lets us apply different role validation and ownership checks in the service.
 */
export class Stage4HandoffDto {
  @IsString()
  @IsNotEmpty()
  current_stack: string;

  @IsString()
  @IsNotEmpty()
  data_available: string;

  @IsString()
  @IsOptional()
  latency_requirement?: string;
}