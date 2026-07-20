import {
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectMilestoneDto {
  @IsNumber()
  @IsNotEmpty()
  milestone_number: number;

  @IsString()
  @IsOptional()
  deliverable_statement?: string;

  @IsNumber()
  @Min(0)
  payment_amount_vnd: number;

  @IsNumber()
  @IsOptional()
  estimated_cost_vnd?: number;

  @IsNumber()
  @IsOptional()
  estimated_duration_days?: number;

}

export class UpdateProjectMilestonesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMilestoneDto)
  milestones: ProjectMilestoneDto[];
}
