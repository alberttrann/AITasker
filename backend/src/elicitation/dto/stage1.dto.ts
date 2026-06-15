import { IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO for Stage 1 elicitation: Extract symptoms from problem description
 */
export class Stage1ExtractDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Symptom text must be at least 10 characters' })
  symptom_text: string;
}
