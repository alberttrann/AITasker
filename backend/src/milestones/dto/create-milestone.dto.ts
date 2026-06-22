import { Type } from 'class-transformer';
import {
  IsString, IsNotEmpty, IsNumber, IsEnum,
  IsUUID, IsBoolean, IsArray, ValidateNested,
  IsOptional, Min,
} from 'class-validator';
import { CreateCriterionDto } from './create-criterion.dto';
export { CreateCriterionDto };

export class CreateMilestoneDto {
  @IsUUID()
  @IsNotEmpty({ message: 'engagement_id cannot be empty.' })
  engagement_id: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(1, { message: 'milestone_number must be greater than zero' })
  milestone_number: number;

  @IsString({ message: 'deliverable_statement must be a valid string.' })
  @IsNotEmpty({ message: 'deliverable_statement cannot be empty.' })
  deliverable_statement: string;

  @IsNotEmpty({ message: 'sign_off_authority cannot be empty.' })
  @IsEnum(['TECH_TEAM', 'CEO', 'JOINT'])
  sign_off_authority: 'TECH_TEAM' | 'CEO' | 'JOINT';

  @IsNumber()
  @Min(1, { message: 'payment_amount_vnd must be greater than zero' })
  payment_amount_vnd: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionDto)
  criteria: CreateCriterionDto[];
}