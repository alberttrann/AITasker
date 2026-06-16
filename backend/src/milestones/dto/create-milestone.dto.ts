import { Type } from 'class-transformer';
import {
  IsString, IsNotEmpty, IsNumber, IsEnum,
  IsUUID, IsBoolean, IsArray, ValidateNested,
  IsOptional, Min,
} from 'class-validator';

// NOTE: fixed typo "CreateCriteriationDto" → "CreateCriterionDto"
export class CreateCriterionDto {
  @IsString()
  @IsNotEmpty()
  criterion_text: string;

  @IsBoolean()
  @IsOptional()
  is_required?: boolean = true;
}

export class CreateMilestoneDto {
  @IsUUID()
  @IsNotEmpty()
  engagement_id: string;

  @IsString()
  @IsNotEmpty()
  deliverable_statement: string;

  @IsEnum(['TECH_TEAM', 'CEO', 'JOINT'])
  @IsNotEmpty()
  sign_off_authority: 'TECH_TEAM' | 'CEO' | 'JOINT';

  @IsNumber()
  @Min(1, { message: 'payment_amount_vnd must be greater than zero' })
  payment_amount_vnd: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionDto)
  criteria: CreateCriterionDto[];
}