import { IsArray, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

// archetype must be one of the 6 valid codes from the blueprint
// (see ai-service TECHNICAL_DOC.md §3 — Archetype codes 1-6).
export class Stage2Dto {
  @IsEnum(['1', '2', '3', '4', '5', '6'], {
    message: 'archetype must be one of: 1 (RAG/Search), 2 (Recommendation), ' +
              '3 (Classification), 4 (Generation), 5 (Prediction), 6 (Multimodal)',
  })
  @IsNotEmpty()
  archetype: '1' | '2' | '3' | '4' | '5' | '6';

  @IsOptional()
  @IsArray()
  acknowledgedVoidCodes?: string[];
}