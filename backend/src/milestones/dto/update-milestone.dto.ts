import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCriterionDto } from './create-criterion.dto'; 

export class UpdateMilestoneDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  deliverable_statement?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  payment_amount_vnd?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  estimated_duration_days?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tech_stack?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionDto)
  @IsOptional()
  criteria?: CreateCriterionDto[];
}
