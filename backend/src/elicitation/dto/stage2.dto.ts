import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for Stage 2 elicitation: Archetype locked
 */
export class Stage2Dto {
  @IsString()
  @IsNotEmpty()
  archetype: string;

  @IsOptional()
  @IsArray()
  voidInjections?: Array<Record<string, unknown>>;
}
