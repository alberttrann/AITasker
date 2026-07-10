import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ArchetypeHistoryItemDto {
  @IsString()
  @IsNotEmpty()
  archetypeCode: string;
  // Archetype code validated dynamically against DB in ExpertProfileService

  @IsEnum(['TIER_1', 'TIER_2', 'TIER_3'], {
    message: 'tier must be TIER_1, TIER_2, or TIER_3 per §0.3',
  })
  tier: string;

  @IsBoolean()
  selfDeclared: boolean;
}

// all fields optional. Caller sends only what they want to change
// writable fields: engagement_model, archetype_history_json, stack_tags_json
export class UpdateExpertProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsEnum(['MILESTONE', 'HOURLY', 'HYBRID'], {
    message: 'engagementModel must be MILESTONE, HOURLY, or HYBRID',
  })
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
