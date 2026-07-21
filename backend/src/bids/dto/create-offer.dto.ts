import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class OfferCriterionDto {
  @IsString()
  @IsNotEmpty()
  criterion_text!: string;

  @IsBoolean()
  @IsOptional()
  is_required?: boolean;
}

class MilestoneOfferTermDto {
  @IsInt()
  @Min(1)
  milestone_number!: number;

  @IsString()
  @IsNotEmpty()
  deliverable_statement!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OfferCriterionDto)
  criteria!: OfferCriterionDto[];

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  price_vnd!: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  estimated_duration_days?: number;

  @IsString()
  @IsOptional()
  condition?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tech_stack?: string[];
}

export class CreateOfferDto {
  @IsInt()
  @Min(1)
  respondingToVersion!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MilestoneOfferTermDto)
  milestones!: MilestoneOfferTermDto[];
}
