import { IsObject, IsOptional } from 'class-validator';

export class Stage4DraftDto {
  @IsObject()
  @IsOptional()
  draftJson?: Record<string, unknown>;
}