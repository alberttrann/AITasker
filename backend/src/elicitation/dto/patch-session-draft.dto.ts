import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PatchSessionDraftDto {
  @ApiPropertyOptional({
    description: 'Raw symptom text draft — saved without AI processing.',
  })
  @IsString()
  @IsOptional()
  symptomTextDraft?: string;
}
