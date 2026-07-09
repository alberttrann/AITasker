import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class Stage2Dto {
  // Archetype code validated dynamically against DB in ElicitationService.processStage2()
  // (no hardcoded enum here — valid codes come from archetype_definitions table)
  @IsString()
  @IsNotEmpty()
  archetype: string;

  @IsOptional()
  @IsArray()
  acknowledgedVoidCodes?: string[];
}