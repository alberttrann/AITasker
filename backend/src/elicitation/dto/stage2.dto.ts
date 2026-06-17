import { IsArray, IsNotEmpty, IsString, IsOptional } from 'class-validator';

/**
 * DTO for Stage 2 elicitation: Archetype selection + void injection acknowledgments.
 * CEO acknowledges each detected void; accepted ones are marked injected: true in void_list_json.
 */
export class Stage2Dto {
  @IsString()
  @IsNotEmpty()
  archetype: string;

  @IsOptional()
  @IsArray()
  acknowledgedVoidCodes?: string[]; // list of void_code strings the CEO accepted
}
