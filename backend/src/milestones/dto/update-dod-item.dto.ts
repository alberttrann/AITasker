import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateMilestoneDoDItemDto {
  @IsEnum(['PENDING', 'NOT_APPLICABLE', 'COMPLETED'])
  @IsNotEmpty()
  status: 'PENDING' | 'NOT_APPLICABLE' | 'COMPLETED';

  @IsString()
  @IsOptional()
  completion_note?: string;

  @IsString()
  @IsOptional()
  not_applicable_note?: string;
}
