import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested,
} from 'class-validator';

class ArchetypeHistoryItemDto {
  // Archetype code validated dynamically against DB in ExpertProfileService.
  @IsString()
  archetypeCode: string;

  @IsEnum(['TIER_1', 'TIER_2', 'TIER_3'])
  tier: string;

  @IsBoolean()
  selfDeclared: boolean;
}

export class UpdateExpertProfileDto {
  @IsOptional()
  @IsString()
  bio?: string; 

  @IsOptional()
  @IsEnum(['MILESTONE', 'HOURLY', 'HYBRID'])
  engagementModel?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArchetypeHistoryItemDto)
  archetypeHistoryJson?: ArchetypeHistoryItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stackTagsJson?: string[];
}