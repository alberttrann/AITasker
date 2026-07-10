import {
  IsArray,
  ValidateNested,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsEnum,
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

  @IsEnum(['CEO', 'TECH_TEAM', 'JOINT'])
  sign_off_authority: 'CEO' | 'TECH_TEAM' | 'JOINT';
}

export class UpdateProjectMilestonesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMilestoneDto)
  milestones: ProjectMilestoneDto[];
}
