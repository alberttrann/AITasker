import {
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
  IsBoolean,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectCriterionDto {
  @IsString()
  @IsNotEmpty()
  criterion_text: string;

  @IsBoolean()
  @IsOptional()
  is_required?: boolean;
}

export class ProjectMilestoneDto {
  @IsNumber()
  @IsNotEmpty()
  milestone_number: number;

  @IsString()
  @IsOptional()
  deliverable_statement?: string;

  @IsNumber()
  @Min(1, { message: 'payment_amount_vnd must be greater than zero' })
  payment_amount_vnd: number;

  @IsNumber()
  @IsOptional()
  estimated_cost_vnd?: number;

  @IsNumber()
  @IsOptional()
  estimated_duration_days?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectCriterionDto)
  @IsOptional()
  criteria?: ProjectCriterionDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tech_stack?: string[];

  @IsString()
  @IsOptional()
  condition?: string;

}

export class UpdateProjectMilestonesDto {
  @ValidateIf((dto: UpdateProjectMilestonesDto, value) => value !== undefined || !dto.milestoneFramework)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMilestoneDto)
  milestones?: ProjectMilestoneDto[];

  /** @deprecated Compatibility alias; normalized into `milestones`. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMilestoneDto)
  milestoneFramework?: ProjectMilestoneDto[];
}
